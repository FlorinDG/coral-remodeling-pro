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
    'invoice_legal': {
        nl: 'Factuur is betaalbaar binnen 30 dagen na factuurdatum. Bij niet-betaling worden intresten aangerekend conform de wet van 2/8/2002.',
        fr: 'Facture payable sous 30 jours à compter de la date de facturation. En cas de non-paiement, des intérêts seront appliqués conformément à la loi du 2/8/2002.',
        en: 'Invoice is payable within 30 days of the invoice date. In the event of non-payment, interest will be charged in accordance with the law of 2/8/2002.',
    },
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
};

export function t(key: string, lang?: string): string {
    const language = (lang || 'nl') as DocumentLanguage;
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry['nl'] || key;
}
