#!/usr/bin/env bash
# Drive the admin and partner pages over HTTP with real session cookies.
#   bash scripts/drive-http.sh /tmp/prep.json http://localhost:3124
P=$1; B=${2:-http://localhost:3124}
j() { node -e "console.log(JSON.parse(require('fs').readFileSync('$P','utf8'))['$1'])"; }
ADMIN="authjs.session-token=$(j adminCookie)"; PART="authjs.session-token=$(j partnerCookie)"; OTHER="authjs.session-token=$(j otherCookie)"
JOB=$(j jobId); ITEM=$(j itemId); INV=$(j inviteToken); TAG=$(j tag)
pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got $2, want $3)"; fail=$((fail+1)); fi; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
has() { curl -s "${@:2}" | grep -c "$1"; }

ck "signed-out /partner goes to login" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/partner | cut -c1-3)" "307"
ck "partner home renders" "$(code -b "$PART" $B/partner)" "200"
ck "partner home lists no quote yet" "$(has 'Nothing waiting' -b "$PART" $B/partner)" "1"
ck "partner cannot see the job before being asked" "$(code -b "$PART" $B/partner/jobs/$JOB)" "404"
ck "admin partners page renders" "$(code -b "$ADMIN" $B/admin/partners)" "200"
ck "admin orders page renders" "$(code -b "$ADMIN" $B/admin/orders)" "200"
ck "admin orders shows the job needing a partner" "$(has 'Stone engraving' -b "$ADMIN" $B/admin/orders | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "non-admin blocked from admin orders" "$(curl -s -o /dev/null -w '%{http_code}' -b "$PART" $B/admin/orders)" "307"
ck "join page needs sign in" "$(code $B/partner/join/$INV)" "307"
ck "print sheet: partner not asked cannot fetch" "$(code -b "$PART" $B/partner/jobs/$JOB/print)" "404"
ck "print sheet: admin can fetch" "$(code -b "$ADMIN" $B/admin/orders/print/$ITEM)" "200"
ck "print sheet: anonymous cannot" "$(code $B/admin/orders/print/$ITEM)" "404"

NEWC="authjs.session-token=$(j newCustCookie)"; DT=$(j draftToken)
LOC=$(curl -s -i -b "$NEWC" $B/order/$DT/finish | grep -i '^location' | tr -d '')
ck "new customer approving is sent to consent, then payment" "$(echo "$LOC" | grep -c 'consent?next=%2Fpay%2F')" "1"
PAYPATH=$(echo "$LOC" | sed 's#.*next=##' | sed 's#%2F#/#g')
ck "after consent the destination is the payment page" "$(echo "$PAYPATH" | grep -c '^/pay/')" "1"
LOC2=$(curl -s -i -b "$NEWC" $B/order/$DT/finish | grep -i '^location' | tr -d '')
ck "approving twice lands on the same payment, no second one" "$([ "$LOC" = "$LOC2" ] && echo same || echo different)" "same"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
