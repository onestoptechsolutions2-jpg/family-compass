#!/usr/bin/env bash
# Walk a signed-in customer through the whole shop over HTTP.
#   bash scripts/drive-shop.sh <prep.json> <base url>
P=$1; B=${2:-http://localhost:3124}
j() { node -e "console.log(JSON.parse(require('fs').readFileSync('$P','utf8'))['$1'])"; }
C="authjs.session-token=$(j cookie)"; T=$(j token); PRICE=$(j price)
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
has() { local n; n=$(curl -s "${@:2}" | grep -c "$1"); [ "$n" -gt 0 ] && echo yes || echo no; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
loc() { curl -s -i "$@" | grep -i '^location' | tr -d '\r' | sed 's/^[Ll]ocation: //'; }

# ---- browsing (no account) -------------------------------------------------
ck "shop renders" "$(code $B/shop)" "200"
ck "shop lists products with price and delivery included" "$(has 'delivery included' $B/shop)" "yes"
ck "aisle filter: wall art shows the wooden tree" "$(has 'Wooden family tree' "$B/shop?aisle=wall_art")" "yes"
ck "aisle filter: wall art hides the tombstone" "$(has 'Tombstone family tree' "$B/shop?aisle=wall_art")" "no"
ck "aisle filter: memorial aisle shows the tombstone" "$(has 'Tombstone family tree' "$B/shop?aisle=memorial_stone")" "yes"
ck "an aisle with nothing that matches says so" "$(has 'Nothing matches' "$B/shop?aisle=events_merch&q=zzzqqq")" "yes"
ck "search finds a product by word" "$(has 'Memorial tile plaque' "$B/shop?q=plaque")" "yes"
ck "search with no match says so" "$(has 'Nothing matches' "$B/shop?q=zzzqqq")" "yes"
ck "sort by price low to high renders" "$(code "$B/shop?sort=price_asc")" "200"
ck "product page has add to cart" "$(has 'Personalise and add to cart' $B/shop/tombstone-family-tree)" "yes"
ck "product page shows the shop header cart" "$(has 'Cart' $B/shop/tombstone-family-tree)" "yes"
ck "signed-out cart asks to sign in" "$(has 'Sign in to see your cart' $B/cart)" "yes"
ck "signed-out orders asks to sign in" "$(has 'Sign in with Google' $B/orders)" "yes"

# ---- adding needs an account ---------------------------------------------------
ck "add to cart signed out goes to sign in and back" "$(loc $B/order/$T/add | grep -c 'login?callbackUrl=%2Forder%2F.*%2Fadd')" "1"
ck "add to cart signed in goes to the cart" "$(loc -b "$C" $B/order/$T/add | grep -c '/cart?added=1')" "1"
ck "adding the same link again lands on the cart, not a dead end" "$(loc -b "$C" $B/order/$T/add | grep -c '/cart')" "1"
ck "the old design link now leads to the cart" "$(loc -b "$C" "$B/order/$T?step=2" | grep -c '/cart')" "1"

# ---- the cart -------------------------------------------------------------------
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')))"; }
curl -s -b "$C" $B/cart > /tmp/cart.html; text -b "$C" $B/cart > /tmp/cart.txt
ck "cart shows the product" "$(grep -c 'Tombstone family tree' /tmp/cart.html | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "cart shows who it is for" "$(grep -c 'For John Kamau' /tmp/cart.txt | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "cart shows a preview of the real design" "$(grep -c 'FULL FAMILY TREE' /tmp/cart.html | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "cart total equals the price, delivery included" "$(grep -o 'KES [0-9,]*' /tmp/cart.html | tr -d ',' | grep -c "KES $PRICE" | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "cart has the shop header count" "$(grep -c 'Cart (1)' /tmp/cart.txt | awk '{print ($1>0)?"yes":"no"}')" "yes"

# ---- editing an item in the cart -------------------------------------------------------
EDIT=$(grep -o '/cart/edit/[a-z0-9]*' /tmp/cart.html | head -1)
ck "each cart item has an Edit link" "$(echo "$EDIT" | grep -c '/cart/edit/')" "1"
EDITLOC=$(loc -b "$C" $B$EDIT)
ck "Edit opens the wizard on a copy" "$(echo "$EDITLOC" | grep -c '/order/.*step=1')" "1"
ET=$(echo "$EDITLOC" | sed 's#.*/order/##; s#?.*##')
ck "the wizard opens with the name already filled in" "$(curl -s -b "$C" "$B/order/$ET?step=1" | grep -c 'value="John"')" "1"
ck "someone signed out cannot open the copy" "$(code "$B/order/$ET?step=1")" "404"
loc -b "$C" $B/order/$ET/add > /dev/null
text -b "$C" $B/cart > /tmp/cart2.txt
ck "finishing the edit leaves one item, not two" "$(grep -o 'Tombstone family tree' /tmp/cart2.txt | wc -l | tr -d ' ')" "1"
ck "the edited cart has a fresh Edit link" "$(curl -s -b "$C" $B/cart | grep -c '/cart/edit/')" "1"
curl -s -b "$C" $B/cart > /tmp/cart.html

# ---- checkout ------------------------------------------------------------------------
ACTION=$(grep -o 'name="\$ACTION_ID_[a-f0-9]*"' /tmp/cart.html | head -1 | sed 's/name="//;s/"//')
ck "checkout form is present" "$(echo "$ACTION" | grep -c ACTION_ID)" "1"
ck "checkout without an address is refused" "$(curl -s -i -b "$C" -X POST $B/cart -F "$ACTION=" -F contactName=Ann -F contactPhone= -F deliveryText= | grep -i '^location' | grep -c 'error=')" "1"
PAYLOC=$(curl -s -i -b "$C" -X POST $B/cart -F "$ACTION=" -F contactName="Ann Kamau" -F contactPhone=0700111222 -F deliveryText="Karen, Nairobi" | grep -i '^location' | tr -d '\r' | sed 's/^[Ll]ocation: //')
ck "placing the order goes to the payment page" "$(echo "$PAYLOC" | grep -c '^/pay/')" "1"
ck "the payment page opens for the customer" "$(code -b "$C" $B$PAYLOC)" "200"
PRICEC=$(node -e "console.log(Number($PRICE).toLocaleString('en-KE'))")
ck "the payment page lists what is being paid for" "$(text -b "$C" $B$PAYLOC | grep -c "Tombstone family tree")" "1"
ck "the payment page shows the full price" "$(text -b "$C" $B$PAYLOC | grep -c "$PRICEC" | awk '{print ($1>0)?"yes":"no"}')" "yes"

# ---- after ordering ---------------------------------------------------------------------
ck "the cart is empty afterwards" "$(has 'Your cart is empty' -b "$C" $B/cart)" "yes"
text -b "$C" $B/orders > /tmp/orders.txt; curl -s -b "$C" $B/orders > /tmp/orders.html
ck "my orders lists the order" "$(grep -c 'Tombstone family tree' /tmp/orders.txt | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "my orders says it is waiting for payment" "$(grep -c 'Waiting for your payment' /tmp/orders.txt | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "my orders offers to pay" "$(grep -c 'Pay now' /tmp/orders.txt | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "my orders links the item's page" "$(grep -c '/q/' /tmp/orders.html | awk '{print ($1>0)?"yes":"no"}')" "yes"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
