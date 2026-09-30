#!/usr/bin/env bash
# Every product's wizard over HTTP: the right questions, a live preview, its own price and options.
# Family trees are built by tapping the tree (3 steps); everything else is a short form (4 steps).
#   bash scripts/drive-layouts.sh <base url>
B=${1:-http://localhost:3124}
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\\s\\S]*?<\\/script>/g,' ').replace(/<!--[\\s\\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,\"'\").replace(/&amp;/g,'&').replace(/\\s+/g,' ')))"; }
has() { local t; t=$(text "$2"); echo "$t" | grep -qi -- "$1" && echo yes || echo no; }
hasraw() { curl -s "$2" | grep -q -- "$1" && echo yes || echo no; }
newdraft() { curl -s -i -H "x-forwarded-for: 10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))" "$B/order/new?product=$1" | grep -i '^location' | sed 's#.*/order/##; s#?.*##' | tr -d '\r'; }

echo "== form products (4 steps)"
# slug | step 1 must ask | step 2 must ask | step 3 must offer
while IFS='|' read -r slug s1 s2 s3; do
  T=$(newdraft "$slug")
  ck "$slug: a draft starts" "$([ -n "$T" ] && echo yes || echo no)" "yes"
  ck "$slug: step 1 of 4 asks '$s1'" "$(has "Step 1 of 4.*$s1" "$B/order/$T?step=1")" "yes"
  ck "$slug: step 2 asks '$s2'" "$(has "$s2" "$B/order/$T?step=2")" "yes"
  ck "$slug: step 3 offers '$s3'" "$(has "$s3" "$B/order/$T?step=3")" "yes"
  ck "$slug: the preview is drawn from step 2" "$(hasraw '<svg' "$B/order/$T?step=2")" "yes"
  ck "$slug: review needs the first step done" "$(has 'Complete the first step' "$B/order/$T?step=4")" "yes"
done <<'EOF'
memorial-prayer-cards|A verse or short line|Add their family|Pack of 100
family-birthday-calendar|Calendar year|Birthdays and anniversaries|A2
reunion-tshirt|Line under the name|Add your family|Double extra large
reunion-name-badges|Event name|Who is coming|Up to 50 guests
wedding-family-tree|Who is getting married|Bring the two families|Solid wood
wedding-tree-poster|Who is getting married|Bring the two families|A2
wedding-tree-framed|Who is getting married|Bring the two families|A2
EOF

echo "== family trees: tap the tree (3 steps)"
# slug | what step 2 must offer
while IFS='|' read -r slug s2; do
  T=$(newdraft "$slug")
  ck "$slug: a draft starts" "$([ -n "$T" ] && echo yes || echo no)" "yes"
  ck "$slug: step 1 of 3 is the builder" "$(has 'Step 1 of 3.*Build your tree' "$B/order/$T?step=1")" "yes"
  ck "$slug: it says what to do: tap a person or a +" "$(has 'Tap a person to change them, or a dashed' "$B/order/$T?step=1")" "yes"
  ck "$slug: it says there is nothing to sign in to" "$(has 'Nothing to sign in to' "$B/order/$T?step=1")" "yes"
  ck "$slug: Continue is off until the middle has a name" "$(curl -s "$B/order/$T?step=1" | grep -c 'disabled=""[^>]*>Continue' | awk '{print ($1>0)?"yes":"no"}')" "yes"
  ck "$slug: no long form of questions any more" "$(has 'Parents (father first' "$B/order/$T?step=1")" "no"
  ck "$slug: step 2 of 3 is material and size, offering '$s2'" "$(has "Step 2 of 3.*Material and size.*$s2" "$B/order/$T?step=2")" "yes"
  ck "$slug: the drawn preview comes with step 2" "$(hasraw '<svg' "$B/order/$T?step=2")" "yes"
  ck "$slug: step 3 of 3 is the review, and needs a name first" "$(has 'Step 3 of 3.*Review.*Complete the first step' "$B/order/$T?step=3")" "yes"
  ck "$slug: there is no fourth step" "$(has 'Step 4 of' "$B/order/$T?step=4")" "no"
done <<'EOF'
tile-plaque-qr|Ceramic tile
tombstone-family-tree|Granite
family-tree-poster|A1
wooden-family-tree|Solid wood
framed-family-tree-print|A3
reunion-banner|Banner
memorial-tree-poster|A1
memorial-tree-framed|A3
memorial-wood-tree|Solid wood
desk-family-tree|Solid wood
EOF
T=$(newdraft reunion-banner)
ck "the banner builder asks for the banner title" "$(has 'Banner title' "$B/order/$T?step=1")" "yes"

# the shop shows them, by aisle
echo "== the shop"
ck "books and print aisle lists the prayer cards" "$(has 'Memorial prayer cards' "$B/shop?aisle=books_print")" "yes"
ck "books and print aisle lists the calendar" "$(has 'Family birthday calendar' "$B/shop?aisle=books_print")" "yes"
ck "events aisle lists the shirt, badges, banner and wedding tree" "$(text "$B/shop?aisle=events_merch" | grep -c -e 'Family reunion T-shirt' -e 'Reunion name badges' -e 'Reunion banner' -e 'Wedding family tree')" "1"
ck "wall art lists the framed print" "$(has 'Framed family tree print' "$B/shop?aisle=wall_art")" "yes"
ck "the events aisle is no longer empty" "$(has 'being stocked' "$B/shop?aisle=events_merch")" "no"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
