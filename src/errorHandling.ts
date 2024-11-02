import { app, dialog } from 'electron'; 

export function handleError(message: string, error: unknown): void {
    console.error(message, error);
    dialog.showErrorBox(message, (error instanceof Error) ? error.message : String(error));
}

export async function showRobloxWarning(): Promise<void> {
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Close App'],
        title: 'Warning',
        message: 'Please open Roblox before starting the overlay.',
    });
    if (response === 0) app.quit(); 
}
