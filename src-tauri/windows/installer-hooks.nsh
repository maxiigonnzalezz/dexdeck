; DexDeck NSIS uninstaller hook.
; The app writes this marker only after the user explicitly chooses full cleanup.
; POSTUNINSTALL runs after the uninstaller has removed the program files.
!macro NSIS_HOOK_POSTUNINSTALL
  IfFileExists "$APPDATA\com.dexdeck.launcher\uninstall-delete-data.flag" 0 dexdeck_keep_user_data
  Delete "$APPDATA\com.dexdeck.launcher\uninstall-delete-data.flag"
  RMDir /r "$APPDATA\com.dexdeck.launcher"
  RMDir /r "$LOCALAPPDATA\com.dexdeck.launcher"
  dexdeck_keep_user_data:
!macroend
