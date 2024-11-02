import { app, BrowserWindow, globalShortcut, screen, ipcMain, dialog } from 'electron';
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import * as path from 'path';
import * as fs from 'fs';
import { platform } from 'os';
import { focusRoblox, isRobloxRunning } from './robloxUtils';
import { loadPreferences, resetPreferences, savePreferences } from './preferences';
import { handleError, showRobloxWarning } from './errorHandling';

app.disableHardwareAcceleration();

const OVERLAY_URL = 'http://162.19.154.182:3000/overlay';

const KEYBOARD_SHORTCUTS = {
    TOGGLE_MOUSE: 'CmdOrCtrl+J',
    CLOSE_KEYBIND: 'CmdOrCtrl+Q',
    FOCUS_ROBLOX: 'CmdOrCtrl+R',
    DETACH_ROBLOX: 'CmdOrCtrl+Shift+D',
    TOGGLE_DEVTOOLS: 'CmdOrCtrl+Shift+I',
    RESET_PREFERENCES: 'CmdOrCtrl+Shift+A+T',
    COMMANDS: [
        { key: 'CmdOrCtrl+E', action: 'Cmd+E' },
        { key: 'CmdOrCtrl+Shift+E', action: 'Cmd+Shift+E' },
        { key: 'CmdOrCtrl+Shift+K', action: 'Cmd+Shift+K' },
        { key: 'CmdOrCtrl+Shift+V', action: 'Cmd+Shift+V' },
        { key: 'Alt+C', action: 'Alt+C' },
        { key: 'Alt+H', action: 'Alt+H' },
        { key: 'Alt+L', action: 'Alt+L' },
        { key: 'Alt+O', action: 'Alt+O' },
    ]
};

interface AppState {
    mainWindow: BrowserWindow | null;
    isInteractable: boolean;
    isQuitting: boolean;
}

const state: AppState = {
    mainWindow: null,
    isInteractable: false,
    isQuitting: false
};

const logFile = path.join(app.getPath('userData'), 'app.log');

async function confirmAction(title: string, message: string): Promise<boolean> {
    const result = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Yes', 'No'],
        title,
        message,
        defaultId: 1,
        cancelId: 1
    });
    return result.response === 0;
}

async function createWindow(): Promise<void> {
    if (!await isRobloxRunning()) {
        await showRobloxWarning();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    state.mainWindow = new BrowserWindow({
        width,
        height,
        frame: false,
        alwaysOnTop: true,
        focusable: true,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        ...OVERLAY_WINDOW_OPTS
    });

    state.mainWindow.loadURL(OVERLAY_URL)
        .then(() => state.mainWindow?.show())
        .catch(err => handleError('Failed to load overlay', err));

    setupEventListeners();
    registerShortcuts();
    setupAutoSave();

    OverlayController.attachByTitle(
        state.mainWindow, 
        platform() === 'darwin' ? 'Roblox' : 'RobloxPlayerBeta.exe'
    );

    state.mainWindow.on('close', async (e) => {
        if (!state.isQuitting) {
            e.preventDefault();
            const shouldClose = await confirmAction(
                'Confirm Exit',
                'Are you sure you want to close the overlay?'
            );
            if (shouldClose) {
                state.isQuitting = true;
                app.quit();
            } else {  
                focusRoblox();
            }
        }
    });
}

function logErrorToFile(error: Error): void {
    const errorMessage = `${new Date().toISOString()} - Uncaught Exception: ${error.message}\nStack Trace:\n${error.stack}\n\n`;
    fs.appendFileSync(logFile, errorMessage);
}

process.on('uncaughtException', (error) => {
    logErrorToFile(error);
    dialog.showErrorBox('Critical Error', 'The application encountered an unexpected error and needs to close.');
    app.quit();
});

function setupAutoSave(): void {
    const AUTOSAVE_INTERVAL = 30000; 
    let saveTimeout: NodeJS.Timeout;

    const debouncedSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            savePreferences();
        }, 1000);
    };

    setInterval(debouncedSave, AUTOSAVE_INTERVAL);
}

function setupEventListeners(): void {
    if (!state.mainWindow) return;

    ipcMain.on('allowMouseInput', () => {
        state.isInteractable = true;
        state.mainWindow?.focus();
        state.mainWindow?.setIgnoreMouseEvents(false, { forward: true });
    });

    ipcMain.on('disableMouseInput', () => {
        focusRoblox();
        state.isInteractable = false;
        state.mainWindow?.setIgnoreMouseEvents(true, { forward: true });
    });

    screen.on('display-metrics-changed', () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        state.mainWindow?.setSize(width, height);
    });

    // Handle window state persistence
    state.mainWindow.on('maximize', () => {
        state.mainWindow?.webContents.send('window-state-change', 'maximized');
    });

    state.mainWindow.on('unmaximize', () => {
        state.mainWindow?.webContents.send('window-state-change', 'normal');
    });
}

async function registerShortcuts(): Promise<void> {
    globalShortcut.register(KEYBOARD_SHORTCUTS.TOGGLE_MOUSE, () => {
        state.isInteractable = !state.isInteractable;
        state.mainWindow?.setIgnoreMouseEvents(!state.isInteractable);
        state.mainWindow?.webContents.send('focus-change', state.isInteractable);
    });

    globalShortcut.register(KEYBOARD_SHORTCUTS.FOCUS_ROBLOX, focusRoblox);

    globalShortcut.register(KEYBOARD_SHORTCUTS.DETACH_ROBLOX, async () => {
        const shouldDetach = await confirmAction(
            'Confirm Detach',
            'Are you sure you want to detach from Roblox and close the application?'
        );
        if (shouldDetach) {
            state.isQuitting = true;
            app.quit();
        }
    });

    globalShortcut.register(KEYBOARD_SHORTCUTS.TOGGLE_DEVTOOLS, () => {
        if (state.mainWindow) {
            state.mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    globalShortcut.register(KEYBOARD_SHORTCUTS.RESET_PREFERENCES, async () => {
        const shouldReset = await confirmAction(
            'Confirm Reset',
            'Are you sure you want to reset all preferences to default?'
        );
        if (shouldReset) {
            resetPreferences();
            state.mainWindow?.webContents.send('preferences-reset');
        }
    });

    KEYBOARD_SHORTCUTS.COMMANDS.forEach(({ key, action }) => {
        globalShortcut.register(key, () => {
            state.mainWindow?.webContents.send('commandKeyPressed', action);
        });
    });
}

loadPreferences();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        state.isQuitting = true;
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('before-quit', () => {
    state.isQuitting = true;
});