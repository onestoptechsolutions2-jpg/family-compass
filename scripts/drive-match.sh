#!/usr/bin/env bash
# The returning-customer question, over HTTP.  bash scripts/drive-match.sh <prep.json> <base url>
P=$1; B=${2:-http://localhost:3124}
j() { node -e "console.log(JSON.parse(require('fs').readFileSync('$P','utf8'))['$1'])"; }
C="authjs.session-token=$(j cookie)"; ITEM=$(j itemId); PETER=$(j peterId); MARY=$(j maryId); FOREIGN=$(j foreignId)
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
text() { curl -s "$@" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d.replace(/<script[\\s\\S]*?<\\/script>/g,' ').replace(/<!--[\\s\\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,\"'\").replace(/\\s+/g,' ')))"; }
loc() { grep -i '^location' | tr -d '\r' | sed 's/^[Ll]ocation: //'; }

text -b "$C" $B/cart > /tmp/mcart.txt
curl -s -b "$C" $B/cart > /tmp/mcart.html
ck "the cart asks whether these are people already in the family" "$(grep -c 'Is this someone already in your family' /tmp/mcart.txt)" "1"
ck "it names what was typed and who they are to the piece" "$(grep -c 'You typed Mary Wanjiku as the person this is for' /tmp/mcart.txt)" "1"
ck "it offers the person already there, with a birth year" "$(grep -c 'Yes, it is Peter Kamau' /tmp/mcart.txt)" "1"
ck "it always offers 'a different person'" "$(grep -c 'No, a different person' /tmp/mcart.txt)" "1"

ACTION=$(grep -o 'name="\$ACTION_ID_[a-f0-9]*"' /tmp/mcart.html | head -1 | sed 's/name="//;s/"//')
KEY_MARY="match:$ITEM:mary wanjiku"; KEY_PETER="match:$ITEM:peter kamau"
post() { curl -s -i -b "$C" -X POST $B/cart -F "$ACTION=" -F contactName="Ann Kamau" -F contactPhone=0700111222 -F deliveryText="Karen, Nairobi" "$@"; }

ck "checkout with the questions unanswered is refused" "$(post | loc | grep -c 'error=Please%20tell%20us%20whether')" "1"
ck "answering only one of two is still refused" "$(post -F "$KEY_MARY=$MARY" | loc | grep -c 'error=Please')" "1"
ck "an answer that is not a person we offered is refused" "$(post -F "$KEY_MARY=$FOREIGN" -F "$KEY_PETER=$PETER" | loc | grep -c 'error=Please')" "1"
ck "a made-up answer is refused" "$(post -F "$KEY_MARY=not-a-real-id" -F "$KEY_PETER=$PETER" | loc | grep -c 'error=Please')" "1"
ck "the cart still holds the item after refusals" "$(text -b "$C" $B/cart | grep -c 'Memorial tile plaque')" "1"

PAY=$(post -F "$KEY_MARY=$MARY" -F "$KEY_PETER=$PETER" | loc)
ck "answering both goes to the payment page" "$(echo "$PAY" | grep -c '^/pay/')" "1"
ck "the cart is empty afterwards" "$(text -b "$C" $B/cart | grep -c 'Your cart is empty')" "1"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
