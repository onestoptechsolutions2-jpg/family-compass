#!/usr/bin/env bash
# The landing page, as a stranger sees it.   bash scripts/drive-landing.sh <prep.json> <base url>
P=$1; B=${2:-http://localhost:3124}
j() { node -e "const d=JSON.parse(require('fs').readFileSync('$P','utf8'));console.log($1)"; }
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\\s\\S]*?<\\/script>/g,' ').replace(/<!--[\\s\\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,\"'\").replace(/&amp;/g,'&').replace(/\\s+/g,' ')))"; }
yes() { [ "$1" -gt 0 ] && echo yes || echo no; }

curl -s $B/ > /tmp/landing.html; text $B/ > /tmp/landing.txt
NACTIVE=$(j "d.active.length")

ck "the landing page loads" "$(curl -s -o /dev/null -w '%{http_code}' $B/)" "200"
ck "it makes one promise, in the first heading" "$(yes $(grep -c "Keepsakes made from your family's story" /tmp/landing.txt))" "yes"
ck "the old genealogy pitch is gone from the landing page" "$(yes $(grep -ci -e 'Start free' -e 'A living record of how families are made' -e 'The problem' -e 'Explore public trees' /tmp/landing.txt))" "no"
ck "there is one way in for a new visitor, not two competing buttons" "$(grep -o 'Get started' /tmp/landing.txt | wc -l | tr -d ' ')" "0"
ck "the header is the shop's: Shop, Cart, Sign in" "$(yes $(grep -c 'Shop.*Cart.*Sign in' /tmp/landing.txt))" "yes"

# products first
ck "a card for every product on sale" "$(grep -o 'href="/shop/[a-z0-9-]*"' /tmp/landing.html | sort -u | wc -l | tr -d ' ')" "$NACTIVE"
for slug in $(j "d.active.map(p=>p.slug).join(' ')"); do
  ck "  $slug: linked" "$(yes $(grep -c "href=\"/shop/$slug\"" /tmp/landing.html))" "yes"
done
for price in $(j "d.active.map(p=>Number(p.basePriceKes).toLocaleString('en-KE').replace(/,/g,'')).join(' ')"); do
  ck "  a price of KES $price is shown" "$(yes $(tr -d ',' < /tmp/landing.txt | grep -c "KES $price"))" "yes"
done
ck "every price says delivery is included" "$([ $(grep -o 'delivery included' /tmp/landing.txt | wc -l | tr -d ' ') -ge $NACTIVE ] && echo yes || echo no)" "yes"
for name in $(j "d.off.map(n=>n.replace(/ /g,'_')).join(' ')"); do
  n=$(echo "$name" | tr '_' ' ')
  ck "  switched off, so not shown: $n" "$(yes $(grep -c "$n" /tmp/landing.txt))" "no"
done
ck "each card invites you to personalise" "$(grep -o 'Personalise' /tmp/landing.txt | wc -l | tr -d ' ')" "$NACTIVE"
ck "products are grouped by what the visitor is doing" "$(yes $(grep -c -e 'Remembering someone' -e 'Celebrating your family' /tmp/landing.txt))" "yes"
ck "cards without a photo show a drawn example, as a small picture" "$([ $(grep -o 'src="/api/sample/' /tmp/landing.html | wc -l | tr -d ' ') -ge 2 ] && echo yes || echo no)" "yes"
ck "the example pictures are real, light images" "$(curl -s -o /tmp/ex.webp -w '%{content_type} %{size_download}' $B/api/sample/landing-qr | awk '{print ($1=="image/webp" && $2>1000 && $2<80000)?"yes":"no"}')" "yes"
ck "an unknown or switched-off product has no example picture" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/sample/no-such-product)" "404"

# how it works and why to trust it
ck "how it works, in four steps" "$(yes $(grep -c 'Choose and personalise.*Pay by M-Pesa.*We make it.*It arrives' /tmp/landing.txt))" "yes"
ck "trust: delivery, M-Pesa, checked before shipping, family stays yours" "$(yes $(grep -c 'Delivery included.*Pay by M-Pesa.*Checked before it ships.*Your family stays yours' /tmp/landing.txt))" "yes"
ck "it explains the QR and the living family page" "$(yes $(grep -c 'Every piece opens a living family page' /tmp/landing.txt))" "yes"
ck "partners and funeral homes have a way in" "$(yes $(grep -c 'Become a partner' /tmp/landing.txt))" "yes"
ck "there is a WhatsApp link with a message ready" "$(yes $(grep -c 'wa.me/254113352048?text=' /tmp/landing.html))" "yes"

# sharing and search
ck "a WhatsApp preview has a title" "$(yes $(grep -c 'property="og:title"' /tmp/landing.html))" "yes"
ck "a WhatsApp preview has a picture (a real address, not a path)" "$(yes $(grep -o 'property="og:image" content="[^"]*"' /tmp/landing.html | grep -c 'http.*granite'))" "yes"
ck "Google is told what is for sale, with prices" "$(yes $(grep -c '"@type":"ItemList"' /tmp/landing.html))" "yes"
ck "the page title says what it is" "$(yes $(grep -c '<title>Family Compass: family trees, memorial plaques' /tmp/landing.html))" "yes"

# speed: a phone on mobile data
SIZE=$(wc -c < /tmp/landing.html | tr -d ' ')
ck "the page is light (under 250 KB of HTML)" "$([ $SIZE -lt 250000 ] && echo yes || echo no)" "yes"
for img in $(grep -o 'src="/samples/[^"]*"' /tmp/landing.html | sed 's/src="//;s/"//' | sort -u); do
  BYTES=$(curl -s $B$img | wc -c | tr -d ' ')
  ck "  photo $img is a small version (under 90 KB)" "$([ $BYTES -lt 90000 ] && [ $BYTES -gt 1000 ] && echo yes || echo no)" "yes"
done

# the pages a QR opens lead to the shop
M=$(j "d.memorial||''"); V=$(j "d.view||''")
if [ -n "$M" ]; then
  ck "the memorial a plaque opens offers to make one for your family" "$(yes $(curl -s $B/m/$M | grep -c 'href="/shop"'))" "yes"
fi
if [ -n "$V" ]; then
  ck "the family page a QR opens leads to the shop" "$(yes $(curl -s $B/s/$V | grep -c 'href="/shop"'))" "yes"
  ck "and no longer to the old free signup" "$(yes $(curl -s $B/s/$V | grep -c 'Start your own family record'))" "no"
fi

# the old pitch lives on About
text $B/about > /tmp/about.txt
ck "About keeps the family-record story" "$(yes $(grep -c 'A living record of how families are made' /tmp/about.txt))" "yes"
ck "About keeps the research statement" "$(yes $(grep -c 'About the project' /tmp/about.txt))" "yes"
ck "About links back to the shop" "$(yes $(curl -s $B/about | grep -c 'href="/shop"'))" "yes"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
