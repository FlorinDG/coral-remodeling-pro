const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'messages', 'ro.json');

const roMobileTrans = {
    "nav_dashboard": "Panou de bord",
    "nav_invoices": "Facturi",
    "nav_purchases": "Achiziții",
    "nav_expenses": "Cheltuieli",
    "nav_clients": "Clienți",
    "shell_desktop_view": "Comutați la versiunea desktop",
    "shell_settings": "Setări",
    "shell_sign_out": "Deconectare",
    "shell_plan": "Abonament",
    "dash_net_profit": "Profit Net",
    "dash_net_loss": "Pierdere Netă",
    "dash_this_month": "luna aceasta",
    "dash_cash_flow": "Flux de Numerar",
    "dash_create_invoice": "Creează Factură",
    "dash_add_expense": "Adaugă Cheltuială",
    "dash_scans": "scanări",
    "dash_drafts": "ciorne",
    "dash_awaiting_payment": "în așteptarea plății",
    "dash_in": "Încasări",
    "dash_out": "Plăți",
    "inv_title": "Facturi de Vânzare",
    "inv_new": "Nou",
    "inv_empty_title": "Nu există facturi încă",
    "inv_empty_desc": "Creați prima factură pentru a începe.",
    "inv_form_back": "Înapoi",
    "inv_form_new": "Factură Nouă",
    "inv_form_create": "Creează",
    "inv_form_client": "Client",
    "inv_form_search_client": "Căutați sau selectați un client...",
    "inv_form_date": "Data Facturii",
    "inv_form_due": "Data Scadentă",
    "inv_form_lines": "Articole",
    "inv_form_desc": "Descriere",
    "inv_form_qty": "Cant",
    "inv_form_unit": "Unitate €",
    "inv_form_vat": "TVA %",
    "inv_form_add_line": "Adaugă Articol",
    "inv_form_subtotal": "Subtotal",
    "inv_form_vat_total": "TVA",
    "inv_form_total": "Total",
    "exp_title": "Cheltuieli",
    "exp_subtitle": "Bonuri și Chitanțe",
    "exp_ocr_scans": "Scanări OCR",
    "exp_used": "utilizate",
    "exp_empty_title": "Nu există cheltuieli încă",
    "exp_empty_desc": "Apăsați pictograma camerei de mai jos pentru a scana un bon.",
    "pur_title": "Facturi de Achiziție",
    "pur_subtitle": "Inbox",
    "pur_peppol_active": "Inbox-ul Peppol este Activ",
    "pur_peppol_desc": "Facturile trimise către numărul dvs. de companie ajung aici automat. Abonamentul dvs. {plan} include {limit} facturi primite pe lună.",
    "pur_empty_title": "Nu există achiziții încă",
    "pur_empty_desc": "Când furnizorii vă trimit facturi electronice Peppol, acestea vor apărea aici.",
    "pur_paid": "Plătit",
    "pur_to_pay": "De Plătit",
    "cli_title": "Clienți",
    "cli_subtitle": "Director",
    "cli_search": "Căutați clienți...",
    "cli_empty_search": "Nu au fost găsiți clienți",
    "cli_empty_search_desc": "Încercați un alt termen de căutare.",
    "cli_empty_title": "Nu există clienți încă",
    "cli_empty_desc": "Adăugați primul dvs. client pentru a începe să creați facturi.",
    "cli_call": "Sună",
    "cli_email": "Trimite Email"
};

const roAdminTrans = {
    "banner_try_mobile": "Încercați noua noastră interfață optimizată pentru mobil!",
    "banner_open_app": "Deschideți Aplicația Mobilă"
};

if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Add Mobile translations
    data.Mobile = roMobileTrans;
    
    // Add Admin translations
    if (data.Admin) {
        data.Admin.banner_try_mobile = roAdminTrans.banner_try_mobile;
        data.Admin.banner_open_app = roAdminTrans.banner_open_app;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ro.json`);
} else {
    console.log(`File not found: ${filePath}`);
}
