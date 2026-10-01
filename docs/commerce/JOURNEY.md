# The customer journey: landing, shop, order

One rule runs through every screen: **the customer always knows what it is, what it costs, and what happens next.** Price is shown before it is asked for, in shillings, with delivery included. Nobody is asked to sign in until they have something to keep.

## The path

| # | Screen | The customer's question | What the screen must answer | The one action |
|---|--------|------------------------|-----------------------------|----------------|
| 1 | Landing `/` | "What is this, and is it for me?" | One promise; real products with a picture and a price; how it works in four steps; why trust it | Open a product |
| 2 | Shop `/shop` | "What can I get, and for how much?" | Every product with a picture and "From KES x"; aisles; search; sort by price | Open a product |
| 3 | Product `/shop/[slug]` | "What exactly would I get? What does it cost me?" | A picture of the piece; the choices (material, colour, size); how generations change the price; what I give us; what happens after | Personalise |
| 4 | Build `/order/[token]` step 1 | "Can I just try it?" | The real piece, tappable; nothing to sign in to; the price as the family grows | Continue |
| 5 | Options step 2 | "Which one, and what will it cost?" | Large choices with colour swatches; a live picture in the chosen colour; an itemised total | Continue |
| 6 | Review step 3 | "Is this right?" | Everything they entered, every choice, the itemised price | Add to cart |
| 7 | Account | "Why am I signing in now?" | Only here, with the design kept through it | Create account / sign in |
| 8 | Cart `/cart` | "What am I paying for?" | Each item with its picture, choices, generations, price; edit, remove; matches to the family already held; delivery details | Place order |
| 9 | Pay `/pay/[id]` | "How do I pay, and is it safe?" | The full amount, what it covers, the M-Pesa details and the reference | Pay, paste the code |
| 10 | My orders `/orders` | "Where is it?" | A plain status for each order from paid, to made, to on its way, to delivered | Track |

## Principles

1. **Product first.** A visitor arrives wanting a thing, not a genealogy tool. Every route leads to a product within one tap.
2. **Show, do not describe.** A real photo where there is one, otherwise a picture drawn from a sample family. Never an emoji.
3. **Price early, itemised, always with delivery included.** "From KES x" in the shop; the choices and generations that move it on the product page; the running total while building; the itemised total at review and in the cart. The price shown is the price charged, from one shared function, in the browser and on the server.
4. **Try before signing in.** Building needs no account; the tree is saved under a private link and remembered in the browser. Sign in appears once, at add to cart, and the design is kept through it.
5. **One thing per screen.** One primary button, one question.
6. **Mobile first.** Most customers are on a phone: tall tappable tree, large radio cards, a 16 px gutter, nothing sideways.
7. **Say what happens next.** Every step ends with what comes after.

## How the price is made

`price = base + material + colour/finish + size + (generations beyond those included × the product's rate)`

- **Generations** are the rows of family a piece shows: the person, their parents, their grandparents, their children. A tree piece includes two; each further generation adds to the price because more is engraved or printed. The rate is set per product (stone dearest, paper cheapest).
- Colour and finish: granite shade, wood tone, paper, frame colour, shirt colour.
- Pieces that are not trees (cards, calendars, badges, shirts) have variants but no generation charge.
- The customer sees all of this before the cart: on the product page (the choices and the rule), while building (generations so far and the total), at options (an itemised total that moves with each tap) and at review.

## Prices are placeholders until you review them

Every price and generation rate in the catalogue is a starting figure. Set the real ones in Admin, Products, and each one is marked reviewed.
