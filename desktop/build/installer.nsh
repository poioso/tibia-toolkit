!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER

Var InstallProfile
Var InstallStandardRadio
Var InstallCustomRadio
Var InstallDirectoryField
Var InstallDesktopShortcut
Var InstallStartMenuShortcut
Var InstallDesktopCheckbox
Var InstallStartMenuCheckbox
Var HadExistingInstallation

!macro customWelcomePage
  Page custom InstallProfilePageCreate InstallProfilePageLeave
!macroend

; Tibia Toolkit is intentionally a per-user application. Existing all-user
; installations still win through electron-builder's isForAllUsers check.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  Page custom CustomInstallOptionsPageCreate CustomInstallOptionsPageLeave
!macroend

!macro customInit
  ; Prevent an older Toolkit process or native mirror host from locking files
  ; while NSIS replaces the installed version.
  ; Do not use /T here: the updater launches this installer as a child of the
  ; app, so killing the app process tree would also terminate the installer.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "Tibia Toolkit.exe"'
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "ScreenVision.NativeHost.exe"'
  Sleep 500

  ; Keep the product folder human-readable on a clean installation. When an
  ; installation already exists, initMultiUser has restored its exact folder
  ; from the registry and this block deliberately leaves it untouched.
  StrCpy $HadExistingInstallation "0"
  ${if} $hasPerUserInstallation == "1"
  ${orif} $hasPerMachineInstallation == "1"
    StrCpy $HadExistingInstallation "1"
  ${else}
    StrCpy $INSTDIR "$LocalAppData\Programs\Tibia Toolkit"
  ${endif}

  StrCpy $InstallProfile "standard"
  StrCpy $InstallDesktopShortcut "1"
  StrCpy $InstallStartMenuShortcut "1"
!macroend

Function InstallProfilePageCreate
  ; Reinstalls and automatic updates must reuse the registered folder without
  ; asking the user to choose an installation profile again.
  ${if} $HadExistingInstallation == "1"
    Abort
  ${endif}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 26u "Selecione uma opcao. A instalacao padrao e recomendada para a maioria dos usuarios."
  Pop $0

  ${NSD_CreateRadioButton} 0 36u 100% 14u "Instalacao padrao (recomendada)"
  Pop $InstallStandardRadio
  ${NSD_CreateLabel} 18u 52u 92% 24u "Instala na pasta recomendada e cria os atalhos normais."
  Pop $0

  ${NSD_CreateRadioButton} 0 86u 100% 14u "Instalacao personalizada"
  Pop $InstallCustomRadio
  ${NSD_CreateLabel} 18u 102u 92% 30u "Permite escolher a pasta do programa e quais atalhos serao criados."
  Pop $0

  ${NSD_Check} $InstallStandardRadio
  nsDialogs::Show
FunctionEnd

Function InstallProfilePageLeave
  ${NSD_GetState} $InstallCustomRadio $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallProfile "custom"
  ${Else}
    StrCpy $InstallProfile "standard"
  ${EndIf}
FunctionEnd

Function CustomInstallOptionsPageCreate
  ${if} $HadExistingInstallation == "1"
    Abort
  ${endif}

  ${If} $InstallProfile != "custom"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "Pasta do programa:"
  Pop $0
  ${NSD_CreateDirRequest} 0 16u 78% 13u "$INSTDIR"
  Pop $InstallDirectoryField
  ${NSD_CreateBrowseButton} 80% 15u 20% 15u "Procurar..."
  Pop $0
  ${NSD_OnClick} $0 BrowseInstallFolder

  ${NSD_CreateCheckbox} 0 50u 100% 14u "Criar atalho na Area de Trabalho"
  Pop $InstallDesktopCheckbox
  ${NSD_Check} $InstallDesktopCheckbox

  ${NSD_CreateCheckbox} 0 72u 100% 14u "Criar atalho no menu Iniciar"
  Pop $InstallStartMenuCheckbox
  ${NSD_Check} $InstallStartMenuCheckbox

  ${NSD_CreateLabel} 0 104u 100% 30u "Configuracoes, cache e login protegido permanecem nas pastas seguras do Windows, independentemente da pasta escolhida."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function BrowseInstallFolder
  nsDialogs::SelectFolderDialog "Escolha a pasta de instalacao" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    ${NSD_SetText} $InstallDirectoryField $0
  ${EndIf}
FunctionEnd

Function CustomInstallOptionsPageLeave
  ${NSD_GetText} $InstallDirectoryField $0
  ${If} $0 == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Escolha uma pasta de instalacao."
    Abort
  ${EndIf}
  StrCpy $INSTDIR $0

  ${NSD_GetState} $InstallDesktopCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallDesktopShortcut "1"
  ${Else}
    StrCpy $InstallDesktopShortcut "0"
  ${EndIf}

  ${NSD_GetState} $InstallStartMenuCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallStartMenuShortcut "1"
  ${Else}
    StrCpy $InstallStartMenuShortcut "0"
  ${EndIf}
FunctionEnd

!macro customInstall
  ; electron-builder creates the configured shortcuts first. On a fresh custom
  ; installation, remove only the shortcuts explicitly disabled by the user.
  ; Updates preserve the previous shortcut state through KeepShortcuts.
  ${if} $HadExistingInstallation == "0"
    ${If} $InstallDesktopShortcut == "0"
      Delete "$newDesktopLink"
      WinShell::UninstShortcut "$newDesktopLink"
    ${EndIf}
    ${If} $InstallStartMenuShortcut == "0"
      Delete "$newStartMenuLink"
      WinShell::UninstShortcut "$newStartMenuLink"
    ${EndIf}
  ${endif}
!macroend

!endif
