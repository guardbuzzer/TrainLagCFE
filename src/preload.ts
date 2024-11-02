import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const validSendChannels = [
    'focus-change',
    'allowMouseInput',
    'disableMouseInput',
    'focus-roblox',
    'focusTab',
    'commandKeyPressed',
] as const;

const validOnChannels = [
    'focus-change',
    'allowMouseInput',
    'disableMouseInput',
    'focus-roblox',
    'focusTab',
    'commandKeyPressed',
] as const;

contextBridge.exposeInMainWorld('electron', {
    send: (channel: typeof validSendChannels[number], data: any) => {
        if (validSendChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.error(`Invalid send channel: ${channel}`);
        }
    },
    on: (channel: typeof validOnChannels[number], func: (...args: any[]) => void) => {
        if (validOnChannels.includes(channel)) {
            ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any[]) => func(...args));
        } else {
            console.error(`Invalid on channel: ${channel}`);
        }
    }
});
