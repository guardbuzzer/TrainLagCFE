import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface Preferences {
    hideRobloxWarning: boolean;
    hidePlatformWarning: boolean;
}

export let userPreferences: Preferences = {
    hideRobloxWarning: false,
    hidePlatformWarning: false,
};

const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');

export function loadPreferences(): void {
    if (fs.existsSync(preferencesPath)) {
        userPreferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    } else {
        savePreferences();
    }
}

export function savePreferences(): void {
    fs.writeFileSync(preferencesPath, JSON.stringify(userPreferences, null, 2));
}

export function resetPreferences(): void {
    fs.unlink(preferencesPath, () => {
        userPreferences = { hideRobloxWarning: false, hidePlatformWarning: false };
        savePreferences();
    });
}

setInterval(() => {
    savePreferences();
}, 10000); 