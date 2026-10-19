<?php

require_once "config.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

header("Content-Type: application/json");

$data = json_decode(file_get_contents('php://input'), true);

$rating = $data['rating'] ?? "";
$name = $data['name'] ?? "";
$email = $data['email'] ?? "";
$review = $data['review'] ?? "";

$product_id = $data['product_id'] ?? "";
$variant_id = $data['variant_id'] ?? "";

if (empty($product_id)) {
     print_r(json_encode([
          'success' => "false",
          'message' => 'Product Id id are required.'
     ]));
     exit;
}

if ($product_id && strpos($product_id, "gid://shopify/Product/") !== 0) {
     $product_id = "gid://shopify/Product/" . $product_id;
}

if ($variant_id && strpos($variant_id, "gid://shopify/ProductVariant/") !== 0) {
     $variant_id = "gid://shopify/ProductVariant/" . $variant_id;
}

$result = [];

$query = <<<GQL
     mutation MetafieldsSet(\$metafields: [MetafieldsSetInput!]!) {
     metafieldsSet(metafields: \$metafields) {
     metafields {
          key
          namespace
          value
          createdAt
          updatedAt
     }
     userErrors {
          field
          message
          code
     }
     }
}
GQL;

$variant_name = "";
if (!empty($variant_id)) {
     $variantQuery = <<<GQL
    query GetVariant(\$id: ID!) {
        productVariant(id: \$id) {
            id
            title
            selectedOptions {
                name
                value
            }
        }
    }
    GQL;

     $variantPayload = [
          'query' => $variantQuery,
          'variables' => [
               'id' => $variant_id
          ]
     ];

     $variantResult = shopifyGraphQL($variantPayload);

     if (!empty($variantResult['data']['productVariant']['selectedOptions'])) {
          $optionValues = [];
          foreach ($variantResult['data']['productVariant']['selectedOptions'] as $option) {
               if (!empty($option['value'])) {
                    $optionValues[] = $option['value'];
               }
          }
          $variant_name = implode(" / ", $optionValues);
     }

     if (empty($variant_name) && !empty($variantResult['data']['productVariant']['title'])) {
          $variant_name = $variantResult['data']['productVariant']['title'];
     }
}

$getMetafieldQuery = <<<GQL
query GetProductMetafield(\$id: ID!) {
    product(id: \$id) {
        id
        tags
        metafield(namespace: "reviews", key: "imported_reviews") {
            id
            namespace
            key
            type
            value
        }
    }
}
GQL;

$getMetafieldPayload = [
     'query' => $getMetafieldQuery,
     'variables' => [
          'id' => $product_id
     ]
];

$existingResult = shopifyGraphQL($getMetafieldPayload);
if (empty($existingResult['data']['product'])) {
     http_response_code(404);
     echo json_encode([
          'success' => false,
          'message' => 'Product not found.',
          'data' => null
     ]);
     exit;
}

$existingReviews = [];
$existingMetafield = $existingResult['data']['product']['metafield'] ?? null;

$tags = $existingResult['data']['product']['tags'] ?? [];
$old_id = "";
foreach ($tags as $tag) {
     if (preg_match('/^old_(.+)_id$/', $tag, $matches)) {
          $old_id = $matches[1];
          break;
     }
}

if (!empty($existingMetafield) && isset($existingMetafield['value'])) {

     $decodedReviews = json_decode($existingMetafield['value'], true);
     if (is_array($decodedReviews)) {
          if (isset($decodedReviews[0]) && is_array($decodedReviews[0])) {
               $existingReviews = $decodedReviews;
          } else {
               $existingReviews[] = $decodedReviews;
          }
     }
}

$newReview = [
     "rSource" => "internal",
     "rItemType" => "product",
     "rItemID" => (string)$old_id,
     "rPVCID" => "0",
     "rName" => $name,
     "rLocation" => "",
     "rSubject" => "",
     "rContent" => $review,
     "rURL" => "",
     "rExternalID" => "",
     "variant_name" => $variant_name,
     "rCreated" => gmdate('Y-m-d\TH:i:s.v\Z')
];

if ($rating !== "") {
     $newReview["rPoints"] = $rating;
}

$existingReviews[] = $newReview;
$metafieldValue = json_encode($existingReviews, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

if ($metafieldValue === false) {
     http_response_code(500);
     echo json_encode([
          'success' => false,
          'message' => 'Failed to encode reviews JSON.',
          'data' => null
     ]);
     exit;
}

$payload = [
     'query' => $query,
     'variables' => [
          'metafields' => [
               [
                    'ownerId' => $product_id,
                    'namespace' => 'reviews',
                    'key' => 'imported_reviews',
                    'type' => 'json',
                    'value' => $metafieldValue
               ]
          ]
     ]
];

$saveResult = shopifyGraphQL($payload);
$userErrors = $saveResult['data']['metafieldsSet']['userErrors'] ?? [];


if (!empty($userErrors)) {
     http_response_code(400);
     echo json_encode([
          'success' => false,
          'message' => 'Failed to save review metafield.',
          'errors' => $userErrors,
          'data' => null
     ]);
     exit;
}

$savedMetafield = $saveResult['data']['metafieldsSet']['metafields'][0] ?? null;
echo json_encode([
     'success' => true,
     'message' => 'Review imported successfully.',
     'data' => [
          'product_id' => $product_id,
          'variant_id' => $variant_id,
          'variant_name' => $variant_name,
          'total_reviews' => count($existingReviews),
     ]
]);

exit;

function shopifyGraphQL($payload)
{
     $ch = curl_init("https://" . SHOP . "/admin/api/" . SHOPIFY_VERSION . "/graphql.json");
     curl_setopt($ch, CURLOPT_POST, true);
     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
     curl_setopt($ch, CURLOPT_HTTPHEADER, [
          'Content-Type: application/json',
          'X-Shopify-Access-Token: ' . ACCESS_TOKEN,
     ]);
     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
     $response = curl_exec($ch);
     curl_close($ch);
     return json_decode($response, true);
}
