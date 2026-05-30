const fs = require('fs');
const path = require('path');

const locales = ['en', 'nl', 'fr'];
const baseDir = path.join(__dirname, 'src', 'messages');

const adminNewTrans = {
    "en": {
        "banner_try_mobile": "Try our new mobile-optimized view!",
        "banner_open_app": "Open Mobile App"
    },
    "nl": {
        "banner_try_mobile": "Probeer onze nieuwe mobiele weergave!",
        "banner_open_app": "Open Mobiele App"
    },
    "fr": {
        "banner_try_mobile": "Essayez notre nouvelle vue mobile optimisée !",
        "banner_open_app": "Ouvrir l'application mobile"
    }
};

locales.forEach(loc => {
    const filePath = path.join(baseDir, `${loc}.json`);
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.Admin) {
            data.Admin.banner_try_mobile = adminNewTrans[loc].banner_try_mobile;
            data.Admin.banner_open_app = adminNewTrans[loc].banner_open_app;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`Updated Admin in ${loc}.json`);
        }
    }
});
