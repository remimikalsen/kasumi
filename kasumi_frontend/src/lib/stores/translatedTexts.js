import { writable } from 'svelte/store';
import { config } from '@lib/config.js';

export const activeLanguage = writable(config.defaultLang);
export const pageHeader = writable('');
export const pageSubHeader =  writable('');
export const documentTitle = writable('');
const loadedTexts = writable({});

let lang;
activeLanguage.subscribe(value => {
    lang = value;
});

let texts;
loadedTexts.subscribe(value => {
    texts = value;
});

export function getLocalizedText(file, element) {
    try {
        return texts[lang][file][element];
    } catch (error) {
        console.error(`Error getting localized text for language: ${lang}, file: ${file}, element: ${element}`, error);
        throw error;
    }
}

export async function loadTexts(file) {

    if (texts[lang] && texts[lang][file]) {
        return;
    }

    try {
        const localeModule = await import(`@lib/translations/${lang}.${file}.json`);
        loadedTexts.update(currentTexts => {
            if (!currentTexts[lang]) {
                currentTexts[lang] = {};
            }
            currentTexts[lang][file] = localeModule.default;
            return currentTexts;
        });
    } catch (error) {
        console.error(`Error loading locale for language: ${lang}, file: ${file}`, error);
        throw error;
    }
}
