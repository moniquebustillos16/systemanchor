<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     *
     * Query: unread_only, type, per_page
     */
    public function index(Request $request): JsonResponse
    {
        $userId = Auth::id();

        $query = Notification::query()
            ->forUser($userId)
            ->latestFirst();

        if ($request->boolean('unread_only')) {
            $query->unread();
        }

        if ($type = $request->string('type')->toString()) {
            if (in_array($type, Notification::TYPES, true)) {
                $query->ofType($type);
            }
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $paginator = $query->paginate($perPage);

        $unreadCount = Notification::forUser($userId)->unread()->count();

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * GET /api/notifications/unread-count
     */
    public function unreadCount(): JsonResponse
    {
        $count = Notification::forUser(Auth::id())->unread()->count();

        return response()->json([
            'data' => [
                'unread_count' => $count,
            ],
        ]);
    }

    /**
     * GET /api/notifications/{id}
     */
    public function show(string $id): JsonResponse
    {
        $notification = Notification::forUser(Auth::id())->findOrFail($id);

        return response()->json([
            'data' => $notification,
        ]);
    }

    /**
     * POST /api/notifications
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:users,id'],
            'type'    => ['required', 'string', Rule::in(Notification::TYPES)],
            'title'   => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'page'    => ['nullable', 'string', 'max:100'],
        ]);

        $notification = Notification::create([
            ...$validated,
            'is_read' => false,
        ]);

        return response()->json([
            'message' => 'Notification created.',
            'data'    => $notification,
        ], 201);
    }

    /**
     * POST /api/notifications/{id}/read
     */
    public function markAsRead(string $id): JsonResponse
    {
        $notification = Notification::forUser(Auth::id())->findOrFail($id);
        $notification->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read.',
            'data'    => $notification->fresh(),
        ]);
    }

    /**
     * POST /api/notifications/read-all
     */
    public function markAllAsRead(): JsonResponse
    {
        $updated = Notification::forUser(Auth::id())
            ->unread()
            ->update(['is_read' => true]);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'data'    => [
                'updated' => $updated,
            ],
        ]);
    }

    /**
     * DELETE /api/notifications/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $notification = Notification::forUser(Auth::id())->findOrFail($id);
        $notification->delete();

        return response()->json([
            'message' => 'Notification dismissed.',
        ]);
    }

    /**
     * DELETE /api/notifications
     */
    public function destroyAll(): JsonResponse
    {
        $deleted = Notification::forUser(Auth::id())->delete();

        return response()->json([
            'message' => 'All notifications cleared.',
            'data'    => [
                'deleted' => $deleted,
            ],
        ]);
    }
}