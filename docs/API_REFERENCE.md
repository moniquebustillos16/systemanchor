# API reference

This is a route-oriented overview of the JSON API, not a generated OpenAPI contract. The definitive route definitions and middleware are in [`backend/routes/api.php`](../backend/routes/api.php); request validation and exact response details are in the relevant controller. Update this document when endpoint paths, permissions, or authentication requirements change.

## Base URL and authentication

The local base URL is `http://127.0.0.1:8000/api`. Production deployments must use HTTPS.

`POST /login` is the public login route. Send the returned token on protected requests:

```http
Authorization: Bearer <sanctum-token>
Accept: application/json
Content-Type: application/json
```

`POST /logout` revokes the current token. Protected routes require an authenticated active account. Most routes also require the permission listed below; the `Admin` role bypasses permission checks, while administrator-only operations have an additional role check. Warehouse-scoped endpoints still restrict records to the user's assigned warehouses.

Common responses include `401` for unauthenticated requests, `403` for inactive or unauthorized accounts, `404` for missing/inaccessible resources, and `422` for validation errors. Some conflicting lifecycle or idempotency operations return `409`. Response envelopes vary by endpoint; inspect its controller for the exact response shape.

## Endpoint groups

| Area | Endpoints | Required permission |
| --- | --- | --- |
| Authentication | `POST /login`, `POST /logout`, `GET /me` | Login is public; other routes require authentication |
| Users | `GET /users`, `GET /users/{id}`, `GET /users/stats`; `POST /users`; `PUT/PATCH/DELETE /users/{id}` | `users.view`, `users.create`, `users.update`, `users.delete`; mutations are administrator-only |
| Roles | `GET /roles`, `GET /roles/{id}`, `GET /roles/stats`; `POST /roles`; `PUT/PATCH/DELETE /roles/{id}` | `roles.view`, `roles.create`, `roles.update`, `roles.delete`; mutations are administrator-only |
| Permissions | `GET /permissions`, `GET /permissions/{id}`, `GET /permissions/stats`; create/update/delete endpoints | Reads require `roles.view`; mutations require the corresponding roles permission and administrator role |
| Role assignments | `GET /roles/{role}/permissions`; `PUT/POST /roles/{role}/permissions[/sync]`; `/role-permissions` assignment routes | Reads require `roles.view`; writes require `roles.update` and administrator role |
| Inventory/products | `/products`, `/inventories`, `/categories`, `/product-images`, `/product-transactions` and their registered detail/mutation routes | Generally `inventory.view/create/update/delete`, depending on the operation |
| Stock movements | `GET /stock-movements`, `/stock-movements/stats`, `/stock-movements/{id}`; `POST /stock-movements` | Reads require `stock.view`; create permission depends on movement type (`stock.in`, `stock.out`, `stock.transfer`, or `stock.adjust`) |
| Purchase orders | `/purchase-orders`, `/purchase-orders/stats`, `/purchase-orders/{id}`; create/update/delete routes | `purchase_orders.view/create/update` |
| Sales orders | `/sales-orders`, `/sales-orders/stats`, `/sales-orders/{id}`; create/update/delete routes | `sales_orders.view/create/update` |
| Receiving | `/goods-receipts`, `/goods-receipts/stats`, `/goods-receipts/{id}`; `POST /goods-receipts/{id}/complete` and mutations | `receiving.view/create/update` |
| Shipping | `/shipments`, `/shipments/stats`, `/shipments/{id}`; `POST /shipments/{id}/deliver` and mutations | `shipping.view/create/update` |
| Returns | `/returns`, `/returns/stats`, `/returns/{id}`; `POST /returns/{id}/complete` and mutations | `returns.view/create/update` |
| Suppliers/customers | `/suppliers` and `/customers` list/detail/create/update/delete routes | `suppliers.*` or `customers.*` for the requested action |
| Warehouses/cycle counts | `/warehouses` and `/cycle-counts` list/detail/stats/create/update/delete routes | `capacity.*` or `cycle_counts.*` |
| Settings | `GET /settings`, `PUT/PATCH /settings` | `settings.view`, `settings.update` |
| Notifications | `/notifications`, `/notifications/unread-count`, read-all, and user-owned notification routes | Authentication; data is scoped to the signed-in user |
| Profile | `/profile`, profile settings, image, session, and two-factor routes | Authentication; data is scoped to the signed-in user |

In the table, `*` means the action-specific permission for that module. Confirm the concrete path and middleware in `routes/api.php`; the table intentionally omits compatibility aliases and less common profile subroutes.

## Pagination and filters

Many list endpoints accept query parameters such as `page`, `per_page`, `search`, `status`, `sort`, and `dir`. Supported filters and defaults are endpoint-specific. Some lookup endpoints have an `all` or `paginate` fast path. Do not assume every endpoint supports every parameter: check the controller before depending on one.

## Example

```bash
curl --fail-with-body \
  --header "Accept: application/json" \
  --header "Authorization: Bearer ${SYSTEMANCHOR_TOKEN}" \
  "http://127.0.0.1:8000/api/sales-orders?per_page=25&page=1"
```

Do not put real tokens in source code, shell history, screenshots, or issue reports. For local API setup, see [README.md](../README.md). For access-control design, see [ARCHITECTURE.md](./ARCHITECTURE.md).
