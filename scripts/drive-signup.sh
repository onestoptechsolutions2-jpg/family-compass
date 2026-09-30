#!/usr/bin/env bash
# A stranger creates an account, is taken where they were going, and can sign in again.
#   bash scripts/drive-signup.sh <base url>
B=${1:-http://localhost:3124}
pass=0; fail=0; trap 'rm -f ./tmp.*' EXIT
export MSYS_NO_PATHCONV=1 # Git Bash must not turn /cart into a Windows path
ck() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
RUN=$RANDOM$RANDOM
EMAIL="shopper$RUN@example.com"
ip() { echo "10.$((RANDOM%250)).$((RANDOM%250)).$((RANDOM%250))"; }
J=$(mktemp -p .)

ck "the sign-in page offers to create an account" "$(curl -s "$B/login?callbackUrl=%2Fcart" | grep -c 'Create an account' | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "the sign-up page loads" "$(curl -s -o /dev/null -w '%{http_code}' "$B/join?next=%2Fcart")" "200"
ck "it asks for name, email and password" "$(curl -s "$B/join" | grep -o -e 'name="name"' -e 'name="email"' -e 'name="password"' | wc -l | tr -d ' ')" "3"
ck "there is a link to sign in instead" "$(curl -s "$B/join" | grep -c 'Already have an account' | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "the cart without an account points to sign in or sign up" "$(curl -s "$B/cart" | grep -c 'Sign in or create an account' | awk '{print ($1>0)?"yes":"no"}')" "yes"

# Post the page's own form, the way a browser without scripts does.
post() { # <url path> <cookie jar> key=value...
  local path=$1 jar=$2; shift 2
  local id; id=$(curl -s "$B$path" | grep -o 'name="\$ACTION_ID_[0-9a-f]*"' | head -1 | sed 's/name="//; s/"$//')
  local args=(-F "$id=")
  for kv in "$@"; do args+=(-F "$kv"); done
  curl -s -i -c "$jar" -b "$jar" -H "x-forwarded-for: $(ip)" "${args[@]}" "$B$path"
}
loc() { grep -i '^location' | head -1 | sed 's/^[^:]*: *//' | tr -d '\r'; }
cookie() { grep -c 'authjs.session-token' "$1" | awk '{print ($1>0)?"yes":"no"}'; }

R=$(post "/join?next=%2Fcart" "$J" name="Ann Kamau" email="$EMAIL" password="a-long-password-1" next="/cart")
ck "creating an account takes you where you were going" "$(echo "$R" | loc)" "/cart"
ck "and signs you in" "$(cookie "$J")" "yes"
ck "the cart now opens for you" "$(curl -s -b "$J" -o /dev/null -w '%{http_code}' "$B/cart")" "200"
ck "the header shows you are signed in" "$(curl -s -b "$J" "$B/shop" | grep -c 'Sign in' | awk '{print ($1>0)?"still out":"in"}')" "in"

J2=$(mktemp -p .)
R=$(post "/join" "$J2" name="Someone Else" email="$EMAIL" password="another-long-pass-2")
ck "a second account with the same email is refused" "$(echo "$R" | loc | grep -c 'error=exists' | awk '{print ($1>0)?"yes":"no"}')" "yes"
ck "and does not sign anyone in" "$(cookie "$J2")" "no"
R=$(post "/login" "$J2" email="$EMAIL" password="another-long-pass-2")
ck "the other person's password does not open the account" "$(echo "$R" | loc | grep -c 'BadCredentials' | awk '{print ($1>0)?"yes":"no"}')" "yes"

J3=$(mktemp -p .)
R=$(post "/join" "$J3" name="Short" email="short$RUN@example.com" password="tiny")
ck "a short password is refused" "$(echo "$R" | loc | grep -c 'error=password' | awk '{print ($1>0)?"yes":"no"}')" "yes"
R=$(post "/join" "$J3" name="Bad" email="not-an-email" password="a-long-password-1")
ck "a bad email is refused" "$(echo "$R" | loc | grep -c 'error=email' | awk '{print ($1>0)?"yes":"no"}')" "yes"
R=$(post "/join" "$J3" name="Evil" email="evil$RUN@example.com" password="a-long-password-1" next="//evil.example")
ck "a sign-up cannot send you to another site" "$(echo "$R" | loc)" "/shop"

J4=$(mktemp -p .)
R=$(post "/login" "$J4" email="$EMAIL" password="a-long-password-1" callbackUrl="/orders")
ck "signing in again works, and goes where you were going" "$(echo "$R" | loc)" "/orders"
ck "and signs you in" "$(cookie "$J4")" "yes"
R=$(post "/login" "$(mktemp -p .)" email="$EMAIL" password="a-long-password-1" callbackUrl="//evil.example")
ck "sign-in cannot send you to another site either" "$(echo "$R" | loc | grep -c 'evil' | awk '{print ($1>0)?"sent away":"safe"}')" "safe"

ck "the forgot-password page loads" "$(curl -s -o /dev/null -w '%{http_code}' "$B/login/forgot")" "200"
ck "it says what to do without email set up" "$(curl -s "$B/login/forgot" | grep -c -e 'WhatsApp' -e 'Email me a sign-in link' | awk '{print ($1>0)?"yes":"no"}')" "yes"

echo "passed $pass, failed $fail"
[ $fail -eq 0 ]
