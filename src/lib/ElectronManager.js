'use strict'

import { app, protocol, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension from 'electron-devtools-installer'
import localshortcut from 'electron-localshortcut'
import { success, error } from 'consola'
import Q from 'q'
import colors from 'colors'
import path from 'path'

require('@electron/remote/main').initialize()

const isDevelopment = process.env.NODE_ENV === 'development'

class ElectronManager {
  constructor () {
    this.win = null
  }

  async loadFrontApp (win) {
    // Load Vue.js in a separate process
    try {
      if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        if (!process.env.IS_TEST) {
          win && win.webContents.openDevTools()
        }
      } else {
        createProtocol('app')
        // Load the index.html when not in development
        await win.loadURL('app://./index.html')
      }
      win.focus()
    } catch (e) {
      this.handleError('The app failed to load properly:', e)
    }
  }

  init () {
    // Scheme must be registered before the app is ready
    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } }
    ])

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.whenReady().then(() => {
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

  onReady () {
    Q.fcall(async () => {
      if (isDevelopment && !process.env.IS_TEST) {
        // Install the beta version of Vue Devtools
        try {
          const vue_devtools_beta = {
            id: 'ljjemllljcmogpfapbkkighbhhppjdbg',
            electron: '>=1.2.1'
          }
          const result = await installExtension(vue_devtools_beta)

          if (result) {
            success(colors.brightGreen(`Initialize ${result} successfully`))
          }
        } catch (e) {
          this.handleError('Vue Devtools failed to install:', e.toString())
        }
      }
    })
      .then(() => {
        this.win = this.createWindow()
        this.createShortcuts()
      })
      .catch((e) => {
        this.handleError('The app failed to initialize properly:', e)
      })
      .done(() => {
        success(colors.brightGreen('Initialize Electron app successfully'))
      })
  }

  onActive () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow()
    }
  }

  handleError (message, e) {
    error(message, e)
  }

  createWindow () {
    // Create a browser window
    let win = new BrowserWindow({
      width: 800,
      height: 600,
      fullscreen: true,
      useContentSize: true,
      frame: true,
      webPreferences: {
        // Use pluginOptions.nodeIntegration, leave this alone
        // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
        nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
        webSecurity: false,
        contextIsolation: false,
        enableRemoteModule: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })

    win.on('closed', () => (win = null))

    this.loadFrontApp(win)

    return win
  }

  createShortcuts () {
    localshortcut.register('Q', () => {
      this.closeAllWindows.apply(this)
    })
    localshortcut.register('R', () => {
      this.reloadAllWindows.apply(this)
    })
    localshortcut.register('D', () => {
      this.toggleDevTools.apply(this)
    })
    localshortcut.register('F', () => {
      this.toggleFullscreen.apply(this)
    })
  }

  reloadAllWindows () {
    this.loadFrontApp(this.win)
  }

  closeAllWindows () {
    app.quit()
  }

  toggleDevTools () {
    this.win.webContents.toggleDevTools()
  }

  toggleFullscreen () {
    this.win.setFullScreen(!this.win.isFullScreen())
  }
}

export default new ElectronManager()
