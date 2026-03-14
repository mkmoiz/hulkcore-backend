# Navigation Menus (Secondary Navbar)

## Folder Structure

- `backend/src/navMenu.js`: normalization + validation + visibility helpers.
- `backend/src/store.js`: DB schema/init + nav menu persistence + publish retrieval.
- `backend/src/server.js`: admin/public routes, auth guard, ETag/cache behavior.
- `backend/src/navMenu.test.js`: unit tests for normalization + visibility rules.

## DB Schema

### `nav_menus`
- `id` `VARCHAR(64)` PK
- `menu_key` `VARCHAR(64)` UNIQUE (e.g. `main_secondary`)
- `name` `VARCHAR(191)`
- `is_active` `TINYINT(1)`
- `version` `INT UNSIGNED`
- `published_payload` `LONGTEXT` nullable
- `published_at` `DATETIME(3)` nullable
- `created_at` `DATETIME(3)`
- `updated_at` `DATETIME(3)`

### `nav_items`
- `id` `VARCHAR(64)` PK
- `menu_id` FK -> `nav_menus.id` (cascade delete)
- `label` `VARCHAR(191)`
- `item_type` `VARCHAR(16)` (`LINK`/`DROPDOWN`)
- `href` `TEXT` nullable
- `target` `VARCHAR(16)` (`_self`/`_blank`)
- `position` `INT UNSIGNED`
- `is_visible` `TINYINT(1)`
- `icon` `VARCHAR(191)`
- `created_at`, `updated_at`

### `nav_dropdown_groups`
- `id` `VARCHAR(64)` PK
- `nav_item_id` FK -> `nav_items.id` (cascade delete)
- `title` `VARCHAR(191)`
- `position` `INT UNSIGNED`
- `created_at`, `updated_at`

### `nav_dropdown_links`
- `id` `VARCHAR(64)` PK
- `group_id` FK -> `nav_dropdown_groups.id` (cascade delete)
- `label` `VARCHAR(191)`
- `href` `TEXT`
- `position` `INT UNSIGNED`
- `badge` `VARCHAR(64)`
- `tracking_tag` `VARCHAR(128)`
- `created_at`, `updated_at`

### `nav_promo_tiles`
- `id` `VARCHAR(64)` PK
- `nav_item_id` FK -> `nav_items.id` (cascade delete)
- `image_url` `TEXT`
- `title` `VARCHAR(191)`
- `subtitle` `VARCHAR(191)`
- `href` `TEXT`
- `position` `INT UNSIGNED`
- `created_at`, `updated_at`

## Endpoints

Admin (requires `x-admin-role: admin`; optional `x-admin-token` if `ADMIN_API_TOKEN` is configured):
- `GET /api/admin/nav-menus`
- `POST /api/admin/nav-menus`
- `GET /api/admin/nav-menus/:id`
- `PUT /api/admin/nav-menus/:id`
- `PUT /api/admin/nav-menus/:id/items`
- `POST /api/admin/nav-menus/:id/publish`

Public:
- `GET /api/public/nav-menus/:key`

Compat aliases are also exposed without `/api` prefix:
- `/admin/nav-menus...`
- `/public/nav-menus/:key`

## Validation Rules

- `LINK` item: `href` required.
- `DROPDOWN` item: must have at least one group with at least one link.
- Positions are auto-normalized (`0..n-1`) for items/groups/links/promo tiles.
- Public payload returns only visible items (`isVisible=true`), sorted by position.

## Error Format

Nav endpoints use:

```json
{
  "error": {
    "code": "NAV_ITEMS_INVALID",
    "message": "Dropdown item \"All Products\" must have at least one group and one link."
  }
}
```

## Example Responses

### `GET /api/admin/nav-menus`

```json
{
  "menus": [
    {
      "id": "nvm_xxx",
      "key": "main_secondary",
      "name": "Main Secondary Navigation",
      "isActive": true,
      "version": 3,
      "publishedAt": "2026-03-03T09:14:29.000Z",
      "createdAt": "2026-03-03T09:10:00.000Z",
      "updatedAt": "2026-03-03T09:14:29.000Z"
    }
  ]
}
```

### `GET /api/admin/nav-menus/:id`

```json
{
  "id": "nvm_xxx",
  "key": "main_secondary",
  "name": "Main Secondary Navigation",
  "isActive": true,
  "version": 3,
  "items": [
    {
      "id": "nvi_xxx",
      "menuId": "nvm_xxx",
      "label": "All Products",
      "type": "DROPDOWN",
      "href": "",
      "target": "_self",
      "position": 0,
      "isVisible": true,
      "icon": "",
      "dropdownGroups": [
        {
          "id": "nvg_xxx",
          "navItemId": "nvi_xxx",
          "title": "Shop by Category",
          "position": 0,
          "links": [
            {
              "id": "nvl_xxx",
              "groupId": "nvg_xxx",
              "label": "Proteins",
              "href": "/collections/proteins",
              "position": 0,
              "badge": "",
              "trackingTag": "proteins"
            }
          ]
        }
      ],
      "promoTiles": []
    }
  ]
}
```

### `POST /api/admin/nav-menus/:id/publish`

```json
{
  "id": "nvm_xxx",
  "key": "main_secondary",
  "name": "Main Secondary Navigation",
  "isActive": true,
  "version": 4,
  "publishedAt": "2026-03-03T09:18:10.000Z",
  "updatedAt": "2026-03-03T09:18:10.000Z",
  "items": [
    {
      "id": "nvi_xxx",
      "label": "Offers",
      "type": "LINK",
      "href": "/offers",
      "target": "_self",
      "position": 1,
      "isVisible": true,
      "icon": "",
      "dropdownGroups": [],
      "promoTiles": []
    }
  ]
}
```

### `GET /api/public/nav-menus/main_secondary`

Headers:
- `ETag: W/"..."`
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`

Body: same published payload as above.
