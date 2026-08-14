<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ShipmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Shipment::with(['salesOrder.customer', 'warehouse'])
            ->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('shipment_number', 'ilike', "%{$search}%")
                  ->orWhere('tracking', 'ilike', "%{$search}%")
                  ->orWhere('carrier', 'ilike', "%{$search}%")
                  ->orWhereHas('salesOrder', function ($so) use ($search) {
                      $so->where('so_number', 'ilike', "%{$search}%");
                  });
            });
        }

        if ($status = $request->query('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        return response()->json($query->paginate(20));
    }

    public function stats()
    {
        return response()->json([
            'all'       => Shipment::count(),
            'open'      => Shipment::whereIn('status', ['shipped', 'processing'])->count(),
            'delivered' => Shipment::where('status', 'completed')->count(),
            'packages'  => (int) Shipment::sum('packages'),
        ]);
    }

    public function show(string $id)
    {
        $shipment = Shipment::with(['salesOrder.customer', 'warehouse'])
            ->findOrFail($id);

        return response()->json($shipment);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sales_order_id' => ['required', 'uuid', 'exists:sales_orders,id'],
            'carrier'        => ['required', 'string', 'max:100'],
            'tracking'       => ['nullable', 'string', 'max:100'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'packages'       => ['required', 'integer', 'min:1'],
            'date'           => ['required', 'date'],
            'status'         => ['nullable', Rule::in(['shipped', 'processing', 'completed'])],
        ]);

        $last = Shipment::withTrashed()->orderByDesc('created_at')->first();
        $seq  = $last ? ((int) Str::after($last->shipment_number, 'SH-')) + 1 : 5501;
        $data['shipment_number'] = 'SH-' . $seq;

        if (empty($data['tracking'])) {
            $data['tracking'] = 'TRK' . Str::upper(Str::random(8));
        }

        $data['status'] = $data['status'] ?? 'shipped';

        $shipment = Shipment::create($data);

        return response()->json(
            $shipment->load(['salesOrder.customer', 'warehouse']),
            201
        );
    }

    public function update(Request $request, string $id)
    {
        $shipment = Shipment::findOrFail($id);

        $data = $request->validate([
            'sales_order_id' => ['sometimes', 'uuid', 'exists:sales_orders,id'],
            'carrier'        => ['sometimes', 'string', 'max:100'],
            'tracking'       => ['nullable', 'string', 'max:100'],
            'warehouse_id'   => ['nullable', 'uuid', 'exists:warehouses,id'],
            'packages'       => ['sometimes', 'integer', 'min:1'],
            'date'           => ['sometimes', 'date'],
            'status'         => ['sometimes', Rule::in(['shipped', 'processing', 'completed'])],
        ]);

        $shipment->update($data);

        return response()->json(
            $shipment->fresh()->load(['salesOrder.customer', 'warehouse'])
        );
    }

    public function deliver(string $id)
    {
        $shipment = Shipment::with('salesOrder')->findOrFail($id);

        if ($shipment->status === 'completed') {
            return response()->json(['message' => 'Shipment already delivered'], 422);
        }

        $shipment->update(['status' => 'completed']);
        $shipment = $shipment->fresh()->load(['salesOrder.customer', 'warehouse']);

        $soNumber = $shipment->salesOrder?->so_number ?? 'SO';
        $this->notifyAll(
            'success',
            'Shipment completed',
            "{$shipment->shipment_number} for {$soNumber} delivered",
            '/shipping'
        );

        return response()->json($shipment);
    }

    public function destroy(string $id)
    {
        $shipment = Shipment::findOrFail($id);
        $shipment->delete();

        return response()->json(null, 204);
    }

    private function notifyAll(string $type, string $title, string $message, string $page): void
    {
        User::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->select('id')
            ->chunkById(100, function ($users) use ($type, $title, $message, $page) {
                foreach ($users as $user) {
                    Notification::create([
                        'user_id' => $user->id,
                        'type'    => $type,
                        'title'   => $title,
                        'message' => $message,
                        'page'    => $page,
                        'is_read' => false,
                    ]);
                }
            });
    }
}