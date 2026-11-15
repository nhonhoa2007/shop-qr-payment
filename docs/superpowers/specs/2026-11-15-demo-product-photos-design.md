# Demo product photos

The user chose to keep the current 50 technology products and add suitable photos for a more visual project demonstration. Keep product identifiers, names, prices, specifications and inventory intact.

Use a checked-in media mapping and local image assets. DummyJSON supplies photos for available product families; manufacturer product pages supply missing accessory types. Where a photo represents another model in the same family, record that explicitly as illustrative in the mapping and image alt text. Do not map keyboards, mice, cables or webcams to unrelated products.

The alternative was replacing the catalog with DummyJSON products; the user rejected that option. Remote-only image URLs are less reliable during demonstrations, so download the selected assets into `public/demo/products/` and record their original URLs.

Update only managed demo/placeholder images and missing images. Preserve custom product photos. Back up the image fields before applying the local database update. The refresh must not create products, hide products, alter prices or move inventory.

Verify image coverage for all 50 products, local asset decoding, safe/idempotent refresh, storefront cards, product details and assistant search cards.
