#!/usr/bin/env bash
# The customer's price journey over HTTP: the range in the shop, the choices on the product page,
# the options step with its itemised total, and a browser that cannot choose what is not offered.
#   bash scripts/drive-variants.sh <base url>
B=${1:-http://localhost:3124}
export MSYS_NO_PATHCONV=1
pass=0; fail=0; trap 'rm -f ./tmp.*' EXIT
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\\s\\S]*?<\\/script>/g,' ').replace(/<!--[\\s\\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,\"'\").replace(/&amp;/g,'&').replace(/\\s+/g,' ')))"; }
has() { text "$2" | grep -qi -- "$1" && echo yes || echo no; }
ip() { echo "10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))"; }
newdraft() { curl -s -i -H "x-forwarded-for: $(ip)" "$B/order/new?product=$1" | grep -i '^location' | sed 's#.*/order/##; s#?.*##' | tr -d '\r'; }
post() { node scripts/post-form.mjs "$B$1" "${@:2}" >/dev/null; } # <path> key=value...

echo "== the shop shows a range, not a single price"
ck "the wooden tree says 'From'" "$(text "$B/shop" | grep -o 'Wooden family tree.\{0,200\}' | head -1 | grep -c 'From KES 15,000' | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "no product card shows an emoji placeholder any more" "$(curl -s "$B/shop" | grep -c '🌳' | awk '{print ($1>0)?"still":"none"}')" "none"
ck "each card has a picture" "$(curl -s "$B/shop" | grep -o 'src="/api/sample/[a-z-]*\|src="/samples/' | wc -l | awk '{print ($1>=15)?"yes":"no"}')" "yes"

echo "== the product page lays out the choices"
ck "it lists the colours" "$(has 'Dark walnut (+KES 1,500)' "$B/shop/wooden-family-tree")" "yes"
ck "it explains what extra generations cost" "$(has 'Each extra generation adds KES 2,000' "$B/shop/wooden-family-tree")" "yes"
ck "it shows a picture" "$(curl -s "$B/shop/desk-family-tree" | grep -c 'api/sample/desk-family-tree' | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "a product with one choice does not show an empty choices box" "$(has 'Choose how yours is made' "$B/shop/reunion-banner")" "no"
ck "no page still talks about a deposit" "$(has 'pay a deposit' "$B/shop/wooden-family-tree")" "no"

echo "== the options step"
T=$(newdraft wooden-family-tree)
ck "a draft starts" "$([ -n "$T" ] && echo yes || echo no)" "yes"
ck "step 2 offers colour and finish" "$(has 'Colour and finish' "$B/order/$T?step=2")" "yes"
ck "with the two woods" "$(has 'Light oak.*Dark walnut' "$B/order/$T?step=2")" "yes"
ck "it shows the itemised total, delivery included" "$(has 'Total.*delivery included.*KES 15,000' "$B/order/$T?step=2")" "yes"
ck "and the picture is drawn before the page loads" "$(curl -s "$B/order/$T?step=2" | grep -c '<svg' | awk '{print ($1>0)?"yes":"no"}')" "yes"

post "/order/$T?step=2" materialKey=wood finishKey=dark
ck "and shows on the review, with its price" "$(has 'Colour and finish: Dark walnut' "$B/order/$T?step=3")" "yes"
ck "the review itemises: base, walnut, total" "$(has 'Base price KES 15,000 Dark walnut +KES 1,500 Total' "$B/order/$T?step=3")" "yes"

echo "== a browser cannot choose what is not offered"
post "/order/$T?step=2" materialKey=gold finishKey=platinum sizeKey=huge
ck "an unknown colour is not kept" "$(has 'Platinum' "$B/order/$T?step=3")" "no"
ck "the earlier valid choice stands" "$(has 'Colour and finish: Dark walnut' "$B/order/$T?step=3")" "yes"
ck "the price is still the honest one" "$(has 'KES 16,500' "$B/order/$T?step=3")" "yes"

echo "== a shirt comes in colours, and the preview is on the shirt"
S=$(newdraft reunion-tshirt)
ck "step 3 of the shirt form asks for the colour" "$(has 'Colour and finish.*Navy' "$B/order/$S?step=3")" "yes"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
