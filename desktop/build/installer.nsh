!macro customInit
  ; Prevent an older Toolkit process or native mirror host from locking files
  ; while NSIS replaces the installed version.
  ; Do not use /T here: the updater launches this installer as a child of the
  ; app, so killing the app process tree would also terminate the installer.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "Tibia Toolkit.exe"'
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ScreenVision.NativeHost.exe"'
  Sleep 500
  ; Keep the product folder human-readable instead of exposing the npm package name.
  StrCpy $INSTDIR "$LocalAppData\Programs\Tibia Toolkit"
!macroend
