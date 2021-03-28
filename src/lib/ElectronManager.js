'use strict'

import { app, protocol, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import electronLocalshortcut from 'electron-localshortcut'
import Q from 'q'
import path from 'path'

require('@electron/remote/main').initialize()

const isDevelopment = process.env.NODE_ENV === 'development'

class ElectronManager {
  constructor() {
    this.win = null
  }

  async loadApp(win) {
    if (process.env.WEBPACK_DEV_SERVER_URL) {
      // Load the url of the dev server if in development mode
      await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
      if (!process.env.IS_TEST) win && win.webContents.openDevTools()
    } else {
      createProtocol('app')
      // Load the index.html when not in development
      win.loadURL('app://./index.html')
    }

    win.focus()
  }

  init() {
    // Scheme must be registered before the app is ready
    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } }
    ])

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', () => {
      this.onReady.apply(this)
    })

    app.on('activate', () => {
      this.onActive.apply(this)
    })

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
      this.closeAllWindows.apply(this)
    })

    // Exit cleanly on request from parent process in development mode.
    if (isDevelopment) {
      if (process.platform === 'win32') {
        process.on('message', (data) => {
          if (data === 'graceful-exit') {
            app.quit()
          }
        })
      } else {
        process.on('SIGTERM', () => {
          app.quit()
        })
      }
    }
  }

  onReady() {
    Q.fcall(async () => {
      if (isDevelopment && !process.env.IS_TEST) {
        // Install Vue Devtools
        try {
          await installExtension(VUEJS_DEVTOOLS)
        } catch (e) {
          this.handleError('Vue Devtools failed to install:', e.toString())
        }
      }
    })
      .then(() => {
        this.win = this.createWindow()
      })
      .then(() => {
        this.createShortcuts()
      })
      .catch((e) => {
        this.handleError('Error while initializing the app:', e)
      })
      .done(() => {
        console.log('Leo --- Initialize the Electron app successfully')
      })
  }

  onActive() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) this.createWindow()
  }

  createWindow() {
    // Create the browser window.
    let win = new BrowserWindow({
      width: 800,
      height: 600,
      fullscreen: true,
      useContentSize: true,
      frame: false,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
        enableRemoteModule: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })

    win.on('closed', () => (win = null))

    this.loadApp(win)

    return win
  }

  createShortcuts() {
    electronLocalshortcut.register('Q', () => {
      this.closeAllWindows.apply(this)
    })
    electronLocalshortcut.register('R', () => {
      this.reloadAllWindows.apply(this)
    })
    electronLocalshortcut.register('D', () => {
      this.toggleDevTools.apply(this)
    })
  }

  closeAllWindows() {
    app.quit()
  }

  reloadAllWindows() {
    console.log(this.win)
    this.loadApp(this.win)
  }

  toggleDevTools() {
    this.win.webContents.toggleDevTools()
  }

  handleError(message, e) {
    console.error(message, e)
  }
}

export default new ElectronManager()
