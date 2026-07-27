# PROTEST INVOICE — ENGLISH SOURCE STRINGS (for NL / FR translation)

**How to use:** these are the `en` values. Florin fills the `nl` and `fr` columns; the coder drops them into `messages/{en,nl,fr}.json` under `Protest.*`. **Do not machine-translate** — a dispute letter that reads as translated undercuts its own credibility.

**Register:** firm but commercial. Factual, unambiguous, no threats, no statutory citations, no legalese. It should read like a professional supplier conversation that happens to also be a written record.

**Placeholders — keep exactly as written, they are filled from the record:**
`{supplierName}` · `{invoiceNumber}` · `{invoiceDate}` · `{invoiceAmount}` · `{disputedAmount}` · `{orderReference}` · `{companyName}` · `{senderName}` · `{detail}`

> Translation notes: keep placeholders in a natural position for the target language (word order may move them). Use the formal register (NL *u*, FR *vous*). Dates and amounts are formatted by the app — translate around them.

---

## 1. Subject line
| key | EN |
|---|---|
| `Protest.subject` | Protest of invoice {invoiceNumber} |
| `Protest.subject_withCompany` | Protest of invoice {invoiceNumber} — {companyName} |

> **Tone check (Florin, 2026-07-27):** the first draft read like a collections notice — stacked fragments, a `Details:` label, passive constructions. **It should sound like a business owner writing to a supplier he'll order from again next month.** Warm, direct, connected prose. Keep exactly **one** unambiguous sentence marking it as a formal protest (that's the legal trace); everything around it is a normal professional conversation. Translators: prioritise this over literal fidelity — if the NL/FR reads stiff, rewrite it so it doesn't.

## 2. Opening
| key | EN |
|---|---|
| `Protest.salutation` | Dear {supplierName}, |
| `Protest.salutation_generic` | Dear Sir or Madam, |
| `Protest.opening` | We received your invoice {invoiceNumber} of {invoiceDate} for {invoiceAmount}. Unfortunately we can't accept it as it stands, and we are formally protesting it for the reason below. |

## 3. Reason paragraphs (one is inserted, then `{detail}` continues the same paragraph)
*Each ends mid-thought with a colon so the user's own detail text flows on naturally — no "Details:" label.*
| key | EN |
|---|---|
| `Protest.reason.wrongAmount` | The amount invoiced doesn't match what we agreed: |
| `Protest.reason.wrongVat` | The VAT on this invoice isn't correct: |
| `Protest.reason.notDelivered` | We haven't received the goods or works this invoice covers: |
| `Protest.reason.wrongQuantity` | The quantities invoiced don't match what was actually delivered: |
| `Protest.reason.priceDiffersFromOrder` | The prices differ from those we agreed in order {orderReference}: |
| `Protest.reason.duplicate` | This looks like a duplicate of an invoice we've already received and booked: |
| `Protest.reason.notOrdered` | We didn't order the goods or services on this invoice: |
| `Protest.reason.damaged` | The goods arrived damaged or didn't match what was agreed: |
| `Protest.reason.other` | There's a problem with this invoice: |

## 4. Disputed amount (optional, flows on from the reason paragraph)
| key | EN |
|---|---|
| `Protest.disputedAmount` | This concerns {disputedAmount} of the total. |

## 5. What we're asking + payment position
| key | EN |
|---|---|
| `Protest.request` | Could you send us a credit note and a corrected invoice, please? We'll hold payment of this invoice until then, and settle it as soon as the corrected document arrives. |
| `Protest.closing` | Happy to go through it by phone or email if that's easier. |

## 6. Sign-off
| key | EN |
|---|---|
| `Protest.signoff` | Kind regards, |
| `Protest.signature` | {senderName}<br>{companyName} |

---

## 7. UI labels (app interface — not part of the letter)
| key | EN |
|---|---|
| `Protest.action.button` | Protest invoice |
| `Protest.dialog.title` | Protest invoice {invoiceNumber} |
| `Protest.field.reason` | Reason for protest |
| `Protest.field.detail` | Additional details |
| `Protest.field.detail.placeholder` | Describe what is wrong (this text is included in the email) |
| `Protest.field.disputedAmount` | Contested amount (optional) |
| `Protest.field.disputedAmount.hint` | Shown to the supplier for information. Payment is suspended in full regardless. |
| `Protest.field.language` | Email language |
| `Protest.field.language.hint` | Taken from the supplier record. Check before sending. |
| `Protest.button.prepareEmail` | Prepare email |
| `Protest.badge.protested` | Protested |
| `Protest.status.protestedOn` | Protested on {invoiceDate} |
| `Protest.warning.noDocument` | No invoice document is attached to this record. You can still send, but a protest is stronger with the invoice attached. |
| `Protest.warning.noEmail` | No email address found for this supplier. Add a recipient before sending. |
| `Protest.resolution.title` | Resolve protest |
| `Protest.resolution.creditNoteReceived` | Credit note received |
| `Protest.resolution.correctedInvoiceReceived` | Corrected invoice received |
| `Protest.resolution.withdrawn` | Protest withdrawn — invoice accepted |
| `Protest.resolution.note` | Note |

---

## 8. Assembled example (so the flow of the letter is visible)
> **Subject:** Protest of invoice 2026-00412 — Coral Group BV
>
> Dear Partena Professional,
>
> We received your invoice 2026-00412 of 16 June 2026 for € 72.68. Unfortunately we can't accept it as it stands, and we are formally protesting it for the reason below.
>
> The VAT on this invoice isn't correct: the works concerned fall under the reverse-charge regime for construction work, so VAT shouldn't have been charged. This concerns € 12.61 of the total.
>
> Could you send us a credit note and a corrected invoice, please? We'll hold payment of this invoice until then, and settle it as soon as the corrected document arrives.
>
> Happy to go through it by phone or email if that's easier.
>
> Kind regards,
> Florin Gheorghita
> Coral Group BV

**What changed and why it matters for translation:** four short paragraphs instead of seven fragments. The reason and the user's detail form **one sentence**, the disputed amount rides along with it, and the ask and the payment position sit together — because in real correspondence "here's the problem" and "here's what I need from you" belong next to each other. The only formal-register phrase left is *"we are formally protesting it"*, which carries the legal weight. Everything else is how you'd actually talk to a supplier. **NL/FR should land the same way** — `wij protesteren deze factuur` / `nous contestons cette facture` as the one formal marker, warm and direct around it.

> **"credit note AND corrected invoice" — not "or" (Florin, 2026-07-27).** This is an accounting point, not a wording preference: the **credit note cancels the wrong invoice** in the books, and the **corrected invoice** is the document actually paid. Sending only a corrected invoice leaves the original sitting uncancelled in both parties' ledgers. Keep the conjunction as **and** in every language (NL *een creditnota én een gecorrigeerde factuur*, FR *une note de crédit et une facture corrigée*), and keep the **"please"** — it's the difference between a request and an instruction.
