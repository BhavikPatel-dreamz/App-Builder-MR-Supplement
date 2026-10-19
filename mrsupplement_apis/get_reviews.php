<?php

require_once "config.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

header("Content-Type: application/json");

$product_id = $_REQUEST['product_id'] ?? "";

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

$getQuery = <<<GQL
query MyQuery(\$id: ID!) {
  product(id: \$id) {
    id
    title
    handle
    metafields(first: 250) {
      edges {
        node {
          namespace
          key
          type
          value
        }
      }
    }
  }
}
GQL;

$payload = [
     "query" => $getQuery,
     "variables" => [
          "id" => $product_id
     ]
];

$result = shopifyGraphQL($payload);
$metaData = $result['data']['product']['metafields']['edges'] ?? "";

$internal_reviews = [];
$old_url = "";
if (!empty($metaData)) {
     foreach ($metaData as $metafiled) {
          $meta_node = $metafiled['node'] ?? [];
          if ($meta_node['key'] === "imported_reviews") {
               $internal_reviews = json_decode($meta_node['value'], true) ?? [];
          }

          if ($meta_node['key'] === "old_url") {
               $old_url = $meta_node['value'] ?? "";
          }
     }
}

$product_handle = $result['data']['product']['handle'] ?? "";
if (empty($old_url) && !empty($product_handle)) {
     $old_url = "https://www.mrsupplement.com.au/" . $product_handle;
}

$page = 1;
$perPage = 100;
$liveReviews = [];

do {
     $live_url = "https://api.trustpilot.com/v1/product-reviews/business-units/" . TRUSTPILOT_BUSINESSUNITID . "/reviews?" . http_build_query(['productUrl' => $old_url, 'page' => $page, 'perPage' => $perPage]);

     $curl = curl_init();
     curl_setopt_array($curl, [
          CURLOPT_URL => $live_url,
          CURLOPT_RETURNTRANSFER => true,
          CURLOPT_ENCODING => '',
          CURLOPT_MAXREDIRS => 10,
          CURLOPT_TIMEOUT => 0,
          CURLOPT_FOLLOWLOCATION => true,
          CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
          CURLOPT_CUSTOMREQUEST => 'GET',
          CURLOPT_HTTPHEADER => [
               'apikey: ' . TRUSTPILOT_CLINET_ID
          ],
     ]);

     $response = curl_exec($curl);
     if ($response === false) {
          curl_close($curl);
          break;
     }

     curl_close($curl);
     $data = json_decode($response, true);
     $reviews = $data['productReviews'] ?? [];

     if (empty($reviews)) {
          break;
     }

     $liveReviews = array_merge($liveReviews, $reviews);

     $page++;
} while (true);

$internal_reviews = array_filter($internal_reviews, function ($review) {
     return ($review['rSource'] ?? '') !== 'trustpilot';
});

$allReviews = array_merge($internal_reviews, $liveReviews);
usort($allReviews, function ($a, $b) {
     $dateA = $a['createdAt'] ?? $a['rCreated'] ?? '';
     $dateB = $b['createdAt'] ?? $b['rCreated'] ?? '';
     $timestampA = !empty($dateA) ? strtotime($dateA) : 0;
     $timestampB = !empty($dateB) ? strtotime($dateB) : 0;
     return $timestampB <=> $timestampA;
});

$allReviews = array_map(function ($review) {
     if (isset($review['id'])) {
          return [
               'rSource' => 'trustpilot',
               'rName' => $review['consumer']['displayName'] ?? '',
               'rLocation' => '',
               'rContent' => $review['content'] ?? '',
               'rCreated' => $review['createdAt'] ?? '',
               'rPoints' => $review['stars'] ?? 0,
               'variant_name' => '',
          ];
     }

     return [
          'rSource' => 'internal',
          'rName' => $review['rName'] ?? '',
          'rLocation' => $review['rLocation'] ?? '',
          'rContent' => $review['rContent'] ?? '',
          'rCreated' => $review['rCreated'] ?? '',
          'rPoints' => $review['rPoints'] ?? 0,
          'variant_name' => $review['variant_name'] ?? '',
     ];
}, $allReviews);

$totalReviews = count($allReviews);
$totalRPoints = array_sum(array_column($allReviews, 'rPoints'));
$averageStar = $totalReviews > 0 ? round($totalRPoints / $totalReviews, 1) : 0;

echo json_encode([
     'success' => true,
     'reviews_counts' => count($allReviews),
     'average_star' => $averageStar,
     'reviews' => $allReviews,
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
