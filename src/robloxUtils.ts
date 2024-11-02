import { exec } from 'child_process';
import { platform } from 'os';

export function focusRoblox(): void {
    const commands: { [key: string]: string } = {
        darwin: `osascript -e 'tell application "Roblox" to activate'`,
        win32: `powershell -command "(Get-Process Roblox).MainWindowHandle"`,
    };
    const currentPlatform = platform();
    const command = commands[currentPlatform];
    
    if (command) exec(command, (err) => {
        if (err) console.error(`Error focusing Roblox on ${currentPlatform}:`, err);
    });
}

export function isRobloxRunning(): Promise<boolean> {
    return new Promise((resolve) => {
        exec(platform() === 'win32' ? 'tasklist' : 'ps aux', (err, stdout) => {
            resolve(stdout.toLowerCase().includes('roblox'));
        });
    });
}
