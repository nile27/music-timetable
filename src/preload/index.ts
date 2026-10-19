// 화면에는 window.api 하나만 노출한다. ipcRenderer를 그대로 넘기면 화면이 아무 채널이나
// 부를 수 있게 되므로, 필요한 기능만 함수로 감싸서 준다.
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  AddFilesResult,
  AppInfo,
  AppSettings,
  HolidayData,
  LibraryTrack,
  PlayerStatus,
  RendererApi,
  SaveScheduleResult,
  Track,
} from '../shared/types';

/** 메인 → 화면 이벤트 구독을 만들고, 해제 함수를 돌려준다. */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: RendererApi = {
  requestPlay: () => ipcRenderer.send(IPC.PLAYER_REQUEST_PLAY),
  requestStop: () => ipcRenderer.send(IPC.PLAYER_REQUEST_STOP),
  playTrack: (trackId) => ipcRenderer.send(IPC.PLAYER_REQUEST_PLAY_TRACK, trackId),
  requestNext: () => ipcRenderer.send(IPC.PLAYER_REQUEST_NEXT),
  requestPrevious: () => ipcRenderer.send(IPC.PLAYER_REQUEST_PREVIOUS),
  onPlay: (listener) => subscribe<Track>(IPC.PLAYER_PLAY, listener),
  onStop: (listener) => subscribe<void>(IPC.PLAYER_STOP, () => listener()),

  listTracks: () => ipcRenderer.invoke(IPC.LIBRARY_LIST) as Promise<LibraryTrack[]>,
  onLibraryChanged: (listener) => subscribe<LibraryTrack[]>(IPC.LIBRARY_CHANGED, listener),
  addFiles: (files) => {
    // File.path는 Electron 32부터 없어졌다. 실제 경로는 preload에서만 얻을 수 있다.
    const paths = files.map((file) => webUtils.getPathForFile(file)).filter((p) => p !== '');
    return ipcRenderer.invoke(IPC.LIBRARY_ADD, paths) as Promise<AddFilesResult>;
  },
  openMusicFolder: () => ipcRenderer.send(IPC.LIBRARY_OPEN_FOLDER),
  removeTrack: (trackId) => ipcRenderer.invoke(IPC.LIBRARY_REMOVE, trackId) as Promise<boolean>,
  reorderTracks: (trackIds) =>
    ipcRenderer.invoke(IPC.LIBRARY_REORDER, trackIds) as Promise<boolean>,

  notifyEnded: (trackId) => ipcRenderer.send(IPC.PLAYER_ENDED, trackId),
  notifyError: (trackId) => ipcRenderer.send(IPC.PLAYER_ERROR, trackId),
  getStatus: () => ipcRenderer.invoke(IPC.STATUS_GET) as Promise<PlayerStatus>,
  onStatus: (listener) => subscribe<PlayerStatus>(IPC.STATUS_UPDATE, listener),

  setSkipToday: (isSkipping) => ipcRenderer.send(IPC.DAY_SKIP_TODAY, isSkipping),
  toggleOffDay: (dateKey) =>
    ipcRenderer.invoke(IPC.DAY_TOGGLE_OFF_DAY, dateKey) as Promise<string[]>,
  getHolidays: () => ipcRenderer.invoke(IPC.DAY_HOLIDAYS) as Promise<HolidayData>,

  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<AppSettings>,
  saveSchedule: (schedule) =>
    ipcRenderer.invoke(IPC.SETTINGS_SAVE, schedule) as Promise<SaveScheduleResult>,
  setVolume: (volume) => ipcRenderer.send(IPC.SETTINGS_SET_VOLUME, volume),
  setAutoLaunch: (isEnabled) => ipcRenderer.send(IPC.SETTINGS_SET_AUTO_LAUNCH, isEnabled),
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_INFO) as Promise<AppInfo>,
};

contextBridge.exposeInMainWorld('api', api);
