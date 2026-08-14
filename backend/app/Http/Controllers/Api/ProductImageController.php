<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductImage;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductImageController extends Controller
{
    /**
     * List images for a product (or all if product_id not given).
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
     * Accepts: product_id + images[] (multipart) or single image.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'   => 'required|uuid|exists:products,id',
            'images'       => 'required|array|min:1',
            'images.*'     => 'image|mimes:jpeg,jpg,png,gif,webp|max:5120', // 5MB
            'is_primary'   => 'sometimes|boolean',
            'sort_order'   => 'sometimes|integer|min:0',
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $uploaded = [];

        DB::transaction(function () use ($request, $product, $validated, &$uploaded) {
            $makePrimary = $request->boolean('is_primary', false);

            // If this upload is marked primary, clear existing primary
            if ($makePrimary) {
                ProductImage::where('product_id', $product->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
            }

            $maxSort = ProductImage::where('product_id', $product->id)->max('sort_order') ?? -1;
            $sortOrder = $validated['sort_order'] ?? ($maxSort + 1);

            foreach ($request->file('images') as $index => $file) {
                $originalName = $file->getClientOriginalName();
                $extension    = $file->getClientOriginalExtension();
                $fileName     = Str::uuid() . '.' . $extension;
                $path         = $file->storeAs(
                    "products/{$product->id}",
                    $fileName,
                    'public'
                );

                $image = ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => $path,
                    'image_url'  => Storage::disk('public')->url($path),
                    'file_name'  => $originalName,
                    'mime_type'  => $file->getMimeType(),
                    'file_size'  => $file->getSize(),
                    'is_primary' => $makePrimary && $index === 0, // only first becomes primary
                    'sort_order' => $sortOrder + $index,
                ]);

                $uploaded[] = $image;
            }
        });

        return response()->json([
            'message' => count($uploaded) . ' image(s) uploaded successfully',
            'data'    => $uploaded,
        ], 201);
    }

    /**
     * Show a single image.
     */
    public function show(string $id)
    {
        $image = ProductImage::with('product:id,name,sku')->findOrFail($id);

        return response()->json($image);
    }

    /**
     * Update image metadata (primary flag, sort order, etc.).
     * Does NOT replace the file – use destroy + store for that.
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
                // Clear other primaries for this product
                ProductImage::where('product_id', $image->product_id)
                    ->where('id', '!=', $image->id)
                    ->where('is_primary', true)
                    ->update(['is_primary' => false]);
            }

            $image->update($validated);
        });

        return response()->json([
            'message' => 'Image updated successfully',
            'data'    => $image->fresh(),
        ]);
    }

    /**
     * Soft-delete an image and remove the file from storage.
     */
    public function destroy(string $id)
    {
        $image = ProductImage::findOrFail($id);

        DB::transaction(function () use ($image) {
            // Delete physical file if it exists
            if ($image->image_path && Storage::disk('public')->exists($image->image_path)) {
                Storage::disk('public')->delete($image->image_path);
            }

            $image->delete(); // soft delete
        });

        return response()->json([
            'message' => 'Image deleted successfully',
        ]);
    }

    /**
     * Set an image as the primary image for its product.
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
            'data'    => $image->fresh(),
        ]);
    }

    /**
     * Reorder images for a product.
     * Body: { "order": ["uuid1", "uuid2", ...] }
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
}