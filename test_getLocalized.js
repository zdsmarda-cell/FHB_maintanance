const getLocalized = (data, lang) => {
    if (!data) return '';
    
    let parsed = data;

    while (typeof parsed === 'string' && (parsed.trim().startsWith('{') || parsed.trim().startsWith('"'))) {
        try {
            const nextParsed = JSON.parse(parsed);
            if (typeof nextParsed === 'string' && nextParsed === parsed) {
                break; 
            }
            parsed = nextParsed;
        } catch (e) {
            break; 
        }
    }

    if (typeof parsed === 'object' && parsed !== null) {
        return parsed[lang] || parsed['cs'] || parsed['en'] || Object.values(parsed)[0] || '';
    }

    return String(parsed);
};

const str1 = '{"cs":"Doplnění přívodního kabelu","en":"[EN] Doplnění přívodního kabelu","uk":"[UK] Doplnění přívodního kabelu"}';
console.log("str1:", getLocalized(str1, 'cs'));

const str2 = '"{\\"cs\\":\\"Doplnění přívodního kabelu\\",\\"en\\":\\"[EN] Doplnění přívodního kabelu\\",\\"uk\\":\\"[UK] Doplnění přívodního kabelu\\"}"';
console.log("str2:", getLocalized(str2, 'cs'));

const str3 = '{"cs":"Doplnění přívodního kabelu","en":"[EN] Doplnění přívodního kabelu","uk":"[UK] Doplnění přívodního kabelu"}';
console.log("str3:", getLocalized(str3, 'en'));
