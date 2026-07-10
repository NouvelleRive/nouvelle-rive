// Test le parser Fleek sur la vraie facture #154621 pour comprendre pourquoi
// les 20 chemises Ralph Lauren n'ont pas été créées.
import { parseFleekInvoice } from '../src/modules/achat/parser/fleek.ts'

const raw = `INVOICE
Fleek Commerce Inc SHIPPING ADDRESS
2261 Market Street #4612
San Francisco, CA
Email: hello@joinfeek.com
Zip Code: 94114
Phone Number: 87-4451473
Phone Number: +33629365197
Email: nouvelleriveparis@gmail.com
8 Rue des Écouffes, Paris, France
Paris, 75004, France
Order Summary
Amount: €846.78
Order Number: #154621
Order Date: 2026-06-12T12:08:21.000Z
Items Qty Price Tax Tax Amount Subtotal
Premium Ralph Lauren Polo Shirts
20 / piece
1 €291.17 0% €0.00 €291.17
Y2K Skirts
8 / piece
1 €83.70 0% €0.00 €83.70
Premium YSL shirts
9 / piece
1 €142.87 0% €0.00 €142.87
Premium Nike Shorts
25 / piece
1 €150.42 0% €0.00 €150.42
Custom handpick Levi's 501 jeans 20
pcs
20 / piece
1 €256.12 0% €0.00 €256.12
Subtotal: €924.28
Shipping: €0.00
Discount: €94.10
Tax: €0.00
Buyer Protection Fee: €16.60
Grand total: €846.78
Paid by customer: €846.78`

const res = parseFleekInvoice(raw)
console.log(JSON.stringify(res, null, 2))
