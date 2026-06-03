/**
 * Document Localization — NL / FR / EN
 * Used across PDF templates and email templates for consistent multi-language support.
 */

export type DocumentLanguage = 'nl' | 'fr' | 'en';

const translations: Record<string, Record<DocumentLanguage, string>> = {
    // Document titles
    'invoice': { nl: 'Factuur', fr: 'Facture', en: 'Invoice' },
    'quotation': { nl: 'Offerte', fr: 'Devis', en: 'Quotation' },
    'credit_note': { nl: 'Creditnota', fr: 'Note de crédit', en: 'Credit Note' },

    // PDF header / sections
    'bill_to': { nl: 'Aan', fr: 'À', en: 'Bill To' },
    'project_re': { nl: 'Project / Betreft', fr: 'Projet / Concerne', en: 'Project / Re' },
    'date': { nl: 'Datum', fr: 'Date', en: 'Date' },
    'due_date': { nl: 'Vervaldatum', fr: 'Échéance', en: 'Due Date' },
    'delivery_date': { nl: 'Leveringsdatum', fr: 'Date de livraison', en: 'Delivery Date' },
    'payment_terms': { nl: 'Betalingstermijn', fr: 'Conditions de paiement', en: 'Payment Terms' },
    'payment_terms_30': { nl: 'Betaling binnen 30 dagen', fr: 'Paiement sous 30 jours', en: 'Payment due within 30 days' },
    'offer_number': { nl: 'Offerte', fr: 'Devis', en: 'Offer' },
    'invoice_num': { nl: 'Offerte Nr.', fr: 'N° Devis', en: 'Invoice #' },

    // Table columns
    'description': { nl: 'Omschrijving', fr: 'Description', en: 'Description' },
    'qty': { nl: 'Aant.', fr: 'Qté', en: 'Qty' },
    'unit': { nl: 'Eenh.', fr: 'Unité', en: 'Unit' },
    'unit_price': { nl: 'Eenheidsprijs', fr: 'Prix unit.', en: 'Unit Price' },
    'total_excl': { nl: 'Totaal (excl.)', fr: 'Total (HTVA)', en: 'Total (Excl.)' },

    // Quotation engine columns
    'col_supplier_discount': { nl: 'Lever.%', fr: 'Fourn.%', en: 'Supp.%' },
    'col_supplier_discount_tooltip': { nl: 'Leverancierskorting — de korting die u van uw leverancier ontvangt', fr: 'Remise fournisseur — la réduction que vous recevez de votre fournisseur', en: 'Supplier discount — the % your supplier gives you' },

    // Summary
    'subtotal_excl': { nl: 'Subtotaal excl. BTW', fr: 'Sous-total HTVA', en: 'Subtotal (Excl. VAT)' },
    'vat': { nl: 'BTW', fr: 'TVA', en: 'VAT' },
    'amount_due': { nl: 'Te betalen', fr: 'Montant dû', en: 'Amount Due' },
    'grand_total_incl': { nl: 'Totaal incl. BTW', fr: 'Total TVAC', en: 'Grand Total (Incl. VAT)' },

    // Footer — legal
    'invoice_legal': { nl: '', fr: '', en: '' },
    'quote_legal': {
        nl: 'Offerte is 30 dagen geldig. De bovenstaande prijzen zijn exclusief onvoorziene werken tenzij anders vermeld.',
        fr: 'Devis valable 30 jours. Les prix ci-dessus excluent les travaux imprévus sauf mention contraire.',
        en: 'Quotation is valid for 30 days. Above prices exclude unforeseen works unless stated otherwise.',
    },

    // Email — invoice
    'email_invoice_heading': { nl: 'Factuur', fr: 'Facture', en: 'Invoice' },
    'email_dear': { nl: 'Beste', fr: 'Cher(e)', en: 'Dear' },
    'email_invoice_body': {
        nl: 'Hierbij sturen wij u de gevraagde factuur. U kan deze online bekijken en downloaden als PDF.',
        fr: 'Veuillez trouver ci-joint votre facture. Vous pouvez la consulter en ligne et la télécharger en PDF.',
        en: 'Please find your invoice attached. You can view it online and download it as PDF.',
    },
    'email_invoice_total': { nl: 'Totaal Factuur', fr: 'Total Facture', en: 'Invoice Total' },
    'email_invoice_button': { nl: 'Bekijk Factuur Online', fr: 'Voir la Facture', en: 'View Invoice Online' },
    'email_invoice_attachment': {
        nl: 'Een PDF kopie van deze factuur is als bijlage aan deze e-mail toegevoegd.',
        fr: 'Une copie PDF de cette facture est jointe à cet e-mail.',
        en: 'A PDF copy of this invoice is attached to this email.',
    },

    // Email — quotation
    'email_quote_heading': { nl: 'Offerte', fr: 'Devis', en: 'Quotation' },
    'email_quote_body': {
        nl: 'Hierbij sturen wij u de gevraagde offerte. U kan deze online bekijken, downloaden als PDF, en veilig online ondertekenen voor akkoord.',
        fr: 'Veuillez trouver ci-joint votre devis. Vous pouvez le consulter en ligne, le télécharger en PDF et le signer en ligne.',
        en: 'Please find your quotation attached. You can view it online, download it as PDF, and securely sign it online.',
    },
    'email_quote_total': { nl: 'Totale Investering', fr: 'Investissement Total', en: 'Total Investment' },
    'email_quote_button': { nl: 'Bekijk en Teken Online', fr: 'Voir et Signer', en: 'View & Sign Online' },
    'email_quote_attachment': {
        nl: 'Een PDF kopie van deze offerte is als bijlage aan deze e-mail toegevoegd.',
        fr: 'Une copie PDF de ce devis est jointe à cet e-mail.',
        en: 'A PDF copy of this quotation is attached to this email.',
    },

    // Email — shared
    'email_regards': { nl: 'Met vriendelijke groeten', fr: 'Cordialement', en: 'Kind regards' },
    'email_team': { nl: 'Het team van', fr: "L'équipe de", en: 'The team at' },
    'email_preview_invoice': { nl: 'Uw factuur is klaar.', fr: 'Votre facture est prête.', en: 'Your invoice is ready.' },
    'email_preview_quote': { nl: 'Uw offerte is klaar.', fr: 'Votre devis est prêt.', en: 'Your quotation is ready.' },

    // Email subjects
    'subject_invoice': { nl: 'Uw Factuur', fr: 'Votre Facture', en: 'Your Invoice' },
    'subject_quote': { nl: 'Uw Offerte', fr: 'Votre Devis', en: 'Your Quotation' },

    // Portal — Quote Acceptance
    'portal_total_investment': { nl: 'Totale Investering', fr: 'Investissement Total', en: 'Total Investment' },
    'portal_ref': { nl: 'REF', fr: 'RÉF', en: 'REF' },
    'portal_quotation_details': { nl: 'Offerte Details', fr: 'Détails du Devis', en: 'Quotation Details' },
    'portal_download_pdf': { nl: 'Download PDF', fr: 'Télécharger PDF', en: 'Download PDF' },
    'portal_section': { nl: 'Sectie', fr: 'Section', en: 'Section' },
    'portal_optional': { nl: 'Optioneel', fr: 'Optionnel', en: 'Optional' },
    'portal_subtotal': { nl: 'Subtotaal', fr: 'Sous-total', en: 'Subtotal' },
    'portal_vat_21': { nl: 'BTW 21%', fr: 'TVA 21%', en: 'VAT 21%' },
    'portal_grand_total': { nl: 'Totaal incl. BTW', fr: 'Total TVAC', en: 'Total incl. VAT' },

    // Portal — Signature
    'portal_sign_title': { nl: 'Digitaal Ondertekenen', fr: 'Signature Numérique', en: 'Digital Signature' },
    'portal_tab_draw': { nl: 'Tekenen', fr: 'Dessiner', en: 'Draw' },
    'portal_tab_type': { nl: 'Typen', fr: 'Taper', en: 'Type' },
    'portal_tab_upload': { nl: 'Uploaden', fr: 'Télécharger', en: 'Upload' },
    'portal_draw_hint': { nl: 'Teken Hier', fr: 'Signez Ici', en: 'Sign Here' },
    'portal_type_placeholder': { nl: 'Typ uw volledige naam...', fr: 'Tapez votre nom complet...', en: 'Type your full name...' },
    'portal_upload_hint': { nl: 'Sleep een afbeelding hierheen of klik om te uploaden', fr: 'Glissez une image ici ou cliquez pour télécharger', en: 'Drag an image here or click to upload' },
    'portal_upload_formats': { nl: 'PNG, JPG — max 2MB', fr: 'PNG, JPG — max 2 Mo', en: 'PNG, JPG — max 2MB' },
    'portal_clear': { nl: 'Wissen', fr: 'Effacer', en: 'Clear' },

    // Portal — Consent
    'portal_consent_text': {
        nl: 'Ik bevestig dat ik deze offerte heb gelezen en ga akkoord met de hierin beschreven voorwaarden.',
        fr: "Je confirme avoir lu ce devis et j'accepte les conditions décrites ci-dessous.",
        en: 'I confirm that I have reviewed this quotation and agree to the terms and conditions described herein.',
    },
    'portal_consent_name_label': { nl: 'Volledige naam', fr: 'Nom complet', en: 'Full name' },
    'portal_consent_name_placeholder': { nl: 'Typ uw volledige naam...', fr: 'Tapez votre nom complet...', en: 'Type your full name...' },
    'portal_accept_button': { nl: 'Offerte Accepteren', fr: 'Accepter le Devis', en: 'Accept Quotation' },
    'portal_processing': { nl: 'Bezig met verwerken...', fr: 'Traitement en cours...', en: 'Processing...' },

    // Portal — Errors
    'portal_error_signature': { nl: 'Plaats a.u.b. uw handtekening.', fr: 'Veuillez signer.', en: 'Please provide your signature.' },
    'portal_error_consent': { nl: 'U dient akkoord te gaan met de voorwaarden.', fr: 'Vous devez accepter les conditions.', en: 'You must accept the terms.' },
    'portal_error_name': { nl: 'Vul a.u.b. uw volledige naam in.', fr: 'Veuillez entrer votre nom complet.', en: 'Please enter your full name.' },
    'portal_error_generic': { nl: 'Er ging iets mis. Probeer het opnieuw.', fr: "Une erreur s'est produite. Veuillez réessayer.", en: 'Something went wrong. Please try again.' },

    // Portal — Expiration
    'portal_valid_until': { nl: 'Deze offerte is geldig tot', fr: 'Ce devis est valable jusqu\'au', en: 'This quotation is valid until' },
    'portal_expired': { nl: 'Deze offerte is verlopen. Neem contact op voor een nieuw voorstel.', fr: 'Ce devis a expiré. Contactez-nous pour une nouvelle proposition.', en: 'This quotation has expired. Please contact us for a new proposal.' },

    // Portal — Success
    'portal_success_title': { nl: 'Offerte Succesvol Geaccepteerd!', fr: 'Devis Accepté avec Succès !', en: 'Quotation Successfully Accepted!' },
    'portal_success_body': { nl: 'Bedankt voor uw vertrouwen. Wij nemen spoedig contact met u op.', fr: 'Merci pour votre confiance. Nous vous contacterons très bientôt.', en: 'Thank you for your trust. We will contact you shortly.' },
    'portal_signed_on': { nl: 'Ondertekend op', fr: 'Signé le', en: 'Signed on' },

    // Portal — Footer
    'portal_powered_by': { nl: 'Powered by', fr: 'Propulsé par', en: 'Powered by' },

    // Portal — Invoice-specific overrides
    'portal_inv_total': { nl: 'Totaal Factuur', fr: 'Total Facture', en: 'Invoice Total' },
    'portal_inv_details': { nl: 'Factuur Details', fr: 'Détails de la Facture', en: 'Invoice Details' },
    'portal_inv_accept_button': { nl: 'Factuur Accepteren', fr: 'Accepter la Facture', en: 'Accept Invoice' },
    'portal_inv_consent_text': {
        nl: 'Ik bevestig dat ik deze factuur heb gelezen en ga akkoord met de hierin beschreven voorwaarden en het verschuldigde bedrag.',
        fr: "Je confirme avoir lu cette facture et j'accepte les conditions et le montant dû décrits ci-dessous.",
        en: 'I confirm that I have reviewed this invoice and agree to the terms and the amount due described herein.',
    },
    'portal_inv_success_title': { nl: 'Factuur Succesvol Geaccepteerd!', fr: 'Facture Acceptée avec Succès !', en: 'Invoice Successfully Accepted!' },
    'portal_inv_success_body': { nl: 'Bedankt. We hebben uw bevestiging ontvangen.', fr: 'Merci. Nous avons reçu votre confirmation.', en: 'Thank you. We have received your confirmation.' },
    'portal_inv_valid_until': { nl: 'Betaling verwacht voor', fr: 'Paiement attendu avant le', en: 'Payment expected by' },
    'portal_inv_expired': { nl: 'De betalingstermijn van deze factuur is verstreken. Neem contact op.', fr: 'Le délai de paiement de cette facture est dépassé. Veuillez nous contacter.', en: 'The payment term for this invoice has passed. Please contact us.' },

    // ── Quotation Engine UI ──────────────────────────────────────────
    'engine_loading': { nl: 'Engine laden...', fr: 'Chargement du moteur...', en: 'Loading Engine...' },
    'engine_not_found': { nl: 'Offerte niet gevonden', fr: 'Devis introuvable', en: 'Quotation Not Found' },
    'engine_go_back': { nl: 'Terug', fr: 'Retour', en: 'Go Back' },
    'engine_draft_quotation': { nl: 'Offerte concept', fr: 'Brouillon de devis', en: 'Draft Quotation' },
    'engine_select_client': { nl: 'Klant selecteren...', fr: 'Sélectionner un client...', en: 'Select client...' },
    'engine_link_project': { nl: 'Project koppelen...', fr: 'Lier un projet...', en: 'Link project...' },
    'engine_status': { nl: 'Status...', fr: 'Statut...', en: 'Status...' },
    'engine_open_record': { nl: 'Open fiche', fr: 'Ouvrir la fiche', en: 'Open record' },
    'engine_status_draft': { nl: 'Concept', fr: 'Brouillon', en: 'Draft' },
    'engine_status_sent': { nl: 'Verzonden', fr: 'Envoyé', en: 'Sent' },
    'engine_status_paid': { nl: 'Betaald', fr: 'Payé', en: 'Paid' },
    'engine_status_overdue': { nl: 'Vervallen', fr: 'Échu', en: 'Overdue' },
    'engine_status_credited': { nl: 'Gecrediteerd', fr: 'Crédité', en: 'Credited' },
    'engine_status_partially_credited': { nl: 'Gedeeltelijk gecrediteerd', fr: 'Partiellement crédité', en: 'Partially Credited' },
    'engine_status_uncollectible': { nl: 'Oninbaar', fr: 'Irrecouvrable', en: 'Uncollectible' },
    'engine_status_accepted': { nl: 'Aanvaard', fr: 'Accepté', en: 'Accepted' },
    'engine_status_rejected': { nl: 'Geweigerd', fr: 'Refusé', en: 'Rejected' },
    'engine_handover': { nl: 'Overdracht', fr: 'Transfert', en: 'Handover' },
    'engine_sending': { nl: 'Verzenden...', fr: 'Envoi en cours...', en: 'Sending...' },
    'engine_send': { nl: 'Versturen', fr: 'Envoyer', en: 'Send' },
    'engine_saving': { nl: 'Opslaan...', fr: 'Sauvegarde...', en: 'Saving...' },
    'engine_drive': { nl: 'Drive', fr: 'Drive', en: 'Drive' },
    'engine_generating': { nl: 'Genereren...', fr: 'Génération...', en: 'Generating...' },
    'engine_export_pdf': { nl: 'PDF Exporteren', fr: 'Exporter PDF', en: 'Export PDF' },
    'engine_export_detailed': { nl: 'Gedetailleerde Offerte', fr: 'Devis Détaillé', en: 'Detailed Quotation' },
    'engine_identity_missing': { nl: 'Identiteit ontbreekt:', fr: 'Identité manquante :', en: 'Identity Missing:' },
    'engine_identity_warning': { nl: 'Uw PDF-exports lijken onvolledig. Vul uw bedrijfsnaam en BTW-nummer in bij de instellingen.', fr: 'Vos exports PDF apparaîtront incomplets. Veuillez renseigner le nom de votre entreprise et votre numéro de TVA dans les paramètres.', en: 'Your PDF exports will appear incomplete. Please link your Company Name and VAT Number in the settings.' },
    'engine_update_settings': { nl: 'Instellingen bijwerken', fr: 'Mettre à jour', en: 'Update Settings' },
    'engine_add_section': { nl: 'Sectie toevoegen', fr: 'Ajouter une section', en: 'Add Section' },
    'engine_add_line': { nl: 'Regel toevoegen', fr: 'Ajouter une ligne', en: 'Add Line' },
    'engine_ai_import': { nl: 'AI PDF Import', fr: 'Import PDF IA', en: 'AI PDF Import' },
    'engine_record_properties': { nl: 'Pagina-eigenschappen', fr: 'Propriétés', en: 'Record Properties' },

    // ── Quotation Footer Report ──────────────────────────────────────
    'footer_overview': { nl: 'Offerteoverzicht', fr: 'Aperçu du devis', en: 'Quotation Overview' },
    'footer_number': { nl: 'Nummer', fr: 'Numéro', en: 'Number' },
    'footer_expiry': { nl: 'Vervaldatum', fr: "Date d'expiration", en: 'Expiry Date' },
    'footer_lines': { nl: 'Regels', fr: 'Lignes', en: 'Lines' },
    'footer_vat_calc': { nl: 'BTW Berekening', fr: 'Calcul TVA', en: 'VAT Calculation' },
    'footer_per_line': { nl: 'Som per lijn', fr: 'Somme par ligne', en: 'Sum per line' },
    'footer_on_total': { nl: '% op totaal', fr: '% sur total', en: '% on total' },
    'footer_subtotal': { nl: 'Subtotaal excl. BTW', fr: 'Sous-total HTVA', en: 'Subtotal excl. VAT' },
    'footer_vat_label': { nl: 'BTW', fr: 'TVA', en: 'VAT' },
    'footer_vat_shifted': { nl: 'Verlegd', fr: 'Autoliquidation', en: 'Reverse charge' },
    'footer_on_base': { nl: 'op', fr: 'sur', en: 'on' },
    'footer_vat_regime': { nl: 'BTW Regime', fr: 'Régime TVA', en: 'VAT Regime' },
    'footer_vat_21': { nl: '21% — Standaard', fr: '21% — Standard', en: '21% — Standard' },
    'footer_vat_12': { nl: '12% — Sociaal woning', fr: '12% — Logement social', en: '12% — Social housing' },
    'footer_vat_6': { nl: '6% — Renovatie (>10j)', fr: '6% — Rénovation (>10 ans)', en: '6% — Renovation (>10yr)' },
    'footer_vat_0': { nl: '0% — Vrijgesteld', fr: '0% — Exonéré', en: '0% — Exempt' },
    'footer_vat_medecontractant': { nl: 'Medecontractant (verlegde BTW)', fr: 'Autoliquidation (TVA inversée)', en: 'Reverse charge (shifted VAT)' },
    'footer_grand_total': { nl: 'Totaal incl. BTW', fr: 'Total TVAC', en: 'Total incl. VAT' },
    'footer_medecontractant_legal': {
        nl: 'Verlegging van heffing. Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand na de ontvangst van de factuur, wordt de afnemer geacht te erkennen dat hij een belastingplichtige is gehouden tot de indiening van periodieke aangiften. Als die voorwaarde niet vervuld is, is de afnemer ten aanzien van die voorwaarde aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten. De algemene verkoopsvoorwaarden zijn van toepassing.',
        fr: "Autoliquidation : En l'absence de contestation par écrit, dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître qu'il est un assujetti tenu au dépôt de déclarations périodiques. Si cette condition n'est pas remplie, le client endossera, par rapport à cette condition, la responsabilité quant au paiement de la taxe, des intérêts et des amendes dus. Les conditions générales de vente s'appliquent.",
        en: 'Reverse charge: In the absence of a written dispute within a period of one month from the receipt of the invoice, the customer is deemed to acknowledge that they are a taxable person liable to file periodic tax returns. If this condition is not met, the customer shall be liable, in respect of this condition, for the payment of the tax, interest, and fines due. The general terms and conditions of sale apply.',
    },
    'footer_vat6_legal': {
        nl: 'Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21% van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.',
        fr: "Taux de TVA: En l'absence de contestation par écrit, dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à un bâtiment d'habitation dont la première occupation a eu lieu au cours d'une année civile qui précède d'au moins dix ans la date de la première facture relative à ces travaux, (2) qu'après l'exécution de ces travaux, l'habitation est utilisée, soit exclusivement, soit à titre principal comme logement privé, et (3) que ces travaux sont fournis et facturés à un consommateur final. Lorsqu'au moins une de ces conditions n'est pas remplie, le taux normal de TVA de 21% sera applicable et le client est, à l'égard de ces conditions, responsable du paiement de la taxe, des intérêts et des amendes dus.",
        en: 'VAT rate: In the absence of written objection within one month of receipt of the invoice, the customer is presumed to acknowledge that (1) the works are carried out on a dwelling first occupied in a calendar year at least ten years before the date of the first invoice relating to those works, (2) after completion the dwelling is used exclusively or principally as a private residence, and (3) the works are supplied and invoiced to an end consumer. If at least one of these conditions is not met, the standard 21% VAT rate applies and the customer is liable for the tax, interest and penalties due.',
    },

    // ── Profitability Summary ────────────────────────────────────────
    'profit_title': { nl: 'Winstgevendheid project', fr: 'Rentabilité du projet', en: 'Project Profitability Estimate' },
    'profit_cost': { nl: 'Totale Kost', fr: 'Coût Total', en: 'Total Cost' },
    'profit_sales': { nl: 'Totale Verkoop', fr: 'Ventes Totales', en: 'Total Sales' },
    'profit_estimate': { nl: 'Geschatte Winst', fr: 'Bénéfice Estimé', en: 'Est. Profit' },
    'profit_margin': { nl: 'Marge %', fr: 'Marge %', en: 'Margin %' },

    // ── Addendum ─────────────────────────────────────────────────────
    'engine_create_addendum': { nl: 'Addendum aanmaken', fr: 'Créer un avenant', en: 'Create Addendum' },
};

export function t(key: string, lang?: string): string {
    const language = (lang || 'nl') as DocumentLanguage;
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry['nl'] || key;
}
