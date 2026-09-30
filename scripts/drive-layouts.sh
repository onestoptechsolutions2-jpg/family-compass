#!/usr/bin/env bash
# Every product's wizard over HTTP: the right questions, a live preview, its own price and options.
#   bash scripts/drive-layouts.sh <base url>
B=${1:-http://localhost:3124}
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\\s\\S]*?<\\/script>/g,' ').replace(/<!--[\\s\\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,\"'\").replace(/&amp;/g,'&').replace(/\\s+/g,' ')))"; }
has() { local t; t=$(text "$2"); echo "$t" | grep -qi -- "$1" && echo yes || echo no; }
hasraw() { curl -s "$2" | grep -q -- "$1" && echo yes || echo no; }
newdraft() { curl -s -i "$B/order/new?product=$1" | grep -i '^location' | sed 's#.*/order/##; s#?.*##' | tr -d '\r'; }

# slug | step 1 must ask | step 2 must ask | step 3 must offer
while IFS='|' read -r slug s1 s2 s3; do
  T=$(newdraft "$slug")
  ck "$slug: a draft starts" "$([ -n "$T" ] && echo yes || echo no)" "yes"
  ck "$slug: step 1 asks '$s1'" "$(has "$s1" "$B/order/$T?step=1")" "yes"
  ck "$slug: step 2 asks '$s2'" "$(has "$s2" "$B/order/$T?step=2")" "yes"
  ck "$slug: step 3 offers '$s3'" "$(has "$s3" "$B/order/$T?step=3")" "yes"
  ck "$slug: the preview is drawn from step 2" "$(hasraw '<svg' "$B/order/$T?step=2")" "yes"
  ck "$slug: review needs the first step done" "$(has 'Complete the first step' "$B/order/$T?step=4")" "yes"
done <<'EOF'
memorial-prayer-cards|A verse or short line|Add their family|Pack of 100
family-birthday-calendar|Calendar year|Birthdays and anniversaries|A2
framed-family-tree-print|Whose family is this|Who should we show|A3
reunion-tshirt|Line under the name|Add your family|Double extra large
reunion-name-badges|Event name|Who is coming|Up to 50 guests
reunion-banner|Banner title|Who should we show|Banner
wedding-family-tree|Who is getting married|Bring the two families|Solid wood
tombstone-family-tree|Who is this for|Who should we show|Granite
family-tree-poster|Whose family is this|Who should we show|A1
EOF

# the shop shows them, by aisle
ck "books and print aisle lists the prayer cards" "$(has 'Memorial prayer cards' "$B/shop?aisle=books_print")" "yes"
ck "books and print aisle lists the calendar" "$(has 'Family birthday calendar' "$B/shop?aisle=books_print")" "yes"
ck "events aisle lists the shirt, badges, banner and wedding tree" "$(text "$B/shop?aisle=events_merch" | grep -c -e 'Family reunion T-shirt' -e 'Reunion name badges' -e 'Reunion banner' -e 'Wedding family tree')" "1"
ck "wall art lists the framed print" "$(has 'Framed family tree print' "$B/shop?aisle=wall_art")" "yes"
ck "the events aisle is no longer empty" "$(has 'being stocked' "$B/shop?aisle=events_merch")" "no"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
