// 화면에는 window.api 하나만 노출한다. ipcRenderer를 그대로 넘기면 화면이 아무 채널이나
// 부를 수 있게 되므로, 필요한 기능만 함수로 감싸서 준다.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { RendererApi, Track } from '../shared/types';

const api: RendererApi = {
  requestPlay: () => ipcRenderer.send(IPC.PLAYER_REQUEST_PLAY),
  requestStop: () => ipcRenderer.send(IPC.PLAYER_REQUEST_STOP),
  onPlay: (listener) => {
    const handler = (_event: IpcRendererEvent, track: Track): void => listener(track);
    ipcRenderer.on(IPC.PLAYER_PLAY, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_PLAY, handler);
  },
  onStop: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on(IPC.PLAYER_STOP, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_STOP, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
