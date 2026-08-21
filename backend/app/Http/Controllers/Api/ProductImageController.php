<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageController extends Controller
{
    /**
     * List images for a product (or all if product_id not given).
     * GET /product-images?product_id=&primary_only=&per_page=
     */
    public function index(Request $request)
    {
        $query = ProductImage::query()->with('product:id,name,sku');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->boolean('primary_only')) {
            $query->where('is_primary', true);
        }

        $images = $query
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        return response()->json($images);
    }

    /**
     * Upload & store one or more product images.
     * POST /product-images
     * body: product_id, images[] (files), is_primary? (0|1), sort_order?
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|uuid|exists:products,id',
            'images'     => 'required|array|min:1',
            'images.*'   => 'image|mimes:jpeg,jpg,png,gif,webp|max:10240', // 10MB
            'is_primary' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        // Reject soft-deleted products
        $product = Product::whereNull('deleted_at')->findOrFail($validated['product_id']);
        $uploaded = [];

        DB::transaction(function () use ($request, $product, $validated, &$uploaded) {
            $makePrimary = $request->boolean('is_primary', false);

            $hasPrimary = ProductImage::where('product_id', $product->id)
                ->where('is_primary', true)
                ->exists();

            // If this upload is marked primary, clear existing primaries
            if ($makePrimary) {
                ProductImage::where('product_id', $product->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
                $hasPrimary = false;
            }

            $maxSort   = ProductImage::where('product_id', $product->id)->max('sort_order') ?? -1;
            $sortOrder = $validated['sort_order'] ?? ($maxSort + 1);

            foreach ($request->file('images') as $index => $file) {
                $originalName = $file->getClientOriginalName();
                $extension    = $file->getClientOriginalExtension() ?: 'jpg';
                $fileName     = Str::uuid() . '.' . $extension;
                $path         = $file->storeAs(
                    "products/{$product->id}",
                    $fileName,
                    'public'
                );

                // First image becomes primary if product has none (or request asked for primary)
                $isPrimary = ($makePrimary && $index === 0)
                    || (!$hasPrimary && $index === 0);

                $image = ProductImage::create([
                    'id'         => (string) Str::uuid(),
                    'product_id' => $product->id,
                    'image_path' => $path,
                    // Prefer generating URL from path (accessor / resource); keep column if schema requires it
                    'image_url'  => Storage::disk('public')->url($path),
                    'file_name'  => $originalName,
                    'mime_type'  => $file->getMimeType(),
                    'file_size'  => $file->getSize(),
                    'is_primary' => $isPrimary,
                    'sort_order' => $sortOrder + $index,
                ]);

                if ($isPrimary) {
                    $hasPrimary = true;
                }

                $uploaded[] = $this->decorate($image);
            }
        });

        return response()->json([
            'message' => count($uploaded) . ' image(s) uploaded successfully',
            'data'    => $uploaded,
        ], 201);
    }

    /**
     * Show a single image.
     * GET /product-images/{id}
     */
    public function show(string $id)
    {
        $image = ProductImage::with('product:id,name,sku')->findOrFail($id);

        return response()->json($this->decorate($image));
    }

    /**
     * Update image metadata (primary flag, sort order).
     * Does NOT replace the file — use destroy + store for that.
     * PUT /product-images/{id}
     */
    public function update(Request $request, string $id)
    {
        $image = ProductImage::findOrFail($id);

        $validated = $request->validate([
            'is_primary' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        DB::transaction(function () use ($image, $validated) {
            if (isset($validated['is_primary']) && $validated['is_primary']) {
                ProductImage::where('product_id', $image->product_id)
                    ->where('id', '!=', $image->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
            }

            $image->update($validated);
        });

        return response()->json([
            'message' => 'Image updated successfully',
            'data'    => $this->decorate($image->fresh()),
        ]);
    }

    /**
     * Soft-delete an image, remove file from storage, promote next primary if needed.
     * DELETE /product-images/{id}
     */
    public function destroy(string $id)
    {
        $image = ProductImage::findOrFail($id);

        DB::transaction(function () use ($image) {
            $productId  = $image->product_id;
            $wasPrimary = (bool) $image->is_primary;

            if ($image->image_path && Storage::disk('public')->exists($image->image_path)) {
                Storage::disk('public')->delete($image->image_path);
            }

            $image->delete();

            // Promote next image if we deleted the primary
            if ($wasPrimary) {
                $next = ProductImage::where('product_id', $productId)
                    ->orderBy('sort_order')
                    ->orderBy('created_at')
                    ->first();

                if ($next) {
                    $next->update(['is_primary' => true]);
                }
            }
        });

        return response()->json([
            'message' => 'Image deleted successfully',
        ]);
    }

    /**
     * Set an image as the primary image for its product.
     * POST /product-images/{id}/primary
     */
    public function setPrimary(string $id)
    {
        $image = ProductImage::findOrFail($id);

        DB::transaction(function () use ($image) {
            ProductImage::where('product_id', $image->product_id)
                ->where('is_primary', true)
                ->update(['is_primary' => false]);

            $image->update(['is_primary' => true]);
        });

        return response()->json([
            'message' => 'Primary image set successfully',
            'data'    => $this->decorate($image->fresh()),
        ]);
    }

    /**
     * Reorder images for a product.
     * POST /product-images/reorder
     * body: { "product_id": "...", "order": ["uuid1", "uuid2", ...] }
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|uuid|exists:products,id',
            'order'      => 'required|array|min:1',
            'order.*'    => 'uuid|exists:product_images,id',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['order'] as $index => $imageId) {
                ProductImage::where('id', $imageId)
                    ->where('product_id', $validated['product_id'])
                    ->update(['sort_order' => $index]);
            }
        });

        return response()->json([
            'message' => 'Images reordered successfully',
        ]);
    }

    /**
     * Consistent API shape for image responses (works with frontend normalizeImageUrl).
     */
    private function decorate(ProductImage $img): array
    {
        $url = null;
        if ($img->image_path) {
            $url = Storage::disk('public')->url($img->image_path);
        } elseif (!empty($img->image_url)) {
            $url = $img->image_url;
        }

        return [
            'id'         => $img->id,
            'product_id' => $img->product_id,
            'image_path' => $img->image_path,
            'image_url'  => $url,
            'file_name'  => $img->file_name,
            'mime_type'  => $img->mime_type ?? null,
            'file_size'  => $img->file_size ?? null,
            'is_primary' => (bool) $img->is_primary,
            'sort_order' => (int) $img->sort_order,
            'created_at' => $img->created_at,
            'updated_at' => $img->updated_at,
            'product'    => $img->relationLoaded('product') && $img->product
                ? [
                    'id'   => $img->product->id,
                    'name' => $img->product->name,
                    'sku'  => $img->product->sku,
                ]
                : null,
        ];
    }
}