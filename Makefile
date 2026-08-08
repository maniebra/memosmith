SHELL := /bin/sh

APP_NAME := MemoSmith
APP_ID := com.local.memosmith
LEGACY_APP_ID := dev.clustrx.memosmith
BIN_NAME := memosmith
TAURI_DIR := src-tauri
ICON_SRC := $(TAURI_DIR)/icons/128x128.png
ICON_SRC_32 := $(TAURI_DIR)/icons/32x32.png
ICON_SRC_256 := $(TAURI_DIR)/icons/128x128@2x.png

UNAME_S := $(shell uname -s 2>/dev/null || echo Windows_NT)
HOST_TARGET := $(shell rustc -vV 2>/dev/null | sed -n 's/^host: //p')
RUST_SYSROOT := $(shell rustc --print sysroot 2>/dev/null)
PREFIX ?= $(HOME)/.local
STRICT ?= 0
XWIN_TOOLS_DIR := $(CURDIR)/$(TAURI_DIR)/target/xwin-tools

ifeq ($(UNAME_S),Darwin)
BUNDLES ?= app dmg
CURRENT_INSTALL := install-macos
CURRENT_UNINSTALL := uninstall-macos
else ifeq ($(OS),Windows_NT)
BUNDLES ?= nsis msi
CURRENT_INSTALL := install-windows
CURRENT_UNINSTALL := uninstall-windows
else
BUNDLES ?= deb rpm
CURRENT_INSTALL := install-linux
CURRENT_UNINSTALL := uninstall-linux
endif

TARGET ?=
TARGET_ARG := $(if $(TARGET),--target $(TARGET),)
TARGET_DIR := $(if $(TARGET),$(TAURI_DIR)/target/$(TARGET)/release,$(TAURI_DIR)/target/release)
BIN_EXT := $(if $(filter $(OS),Windows_NT),.exe,)
BUILT_BIN := $(TARGET_DIR)/$(BIN_NAME)$(BIN_EXT)

LINUX_TARGETS := x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu
MACOS_TARGETS := aarch64-apple-darwin
WINDOWS_TARGETS := x86_64-pc-windows-msvc aarch64-pc-windows-msvc i686-pc-windows-msvc
ALL_TARGETS := $(LINUX_TARGETS) $(MACOS_TARGETS) $(WINDOWS_TARGETS)

LINUX_APP_DIR := $(PREFIX)/share/$(BIN_NAME)
LINUX_DESKTOP_DIR := $(PREFIX)/share/applications
LINUX_ICON_BASE := $(PREFIX)/share/icons/hicolor
LINUX_ICON_DIR_32 := $(LINUX_ICON_BASE)/32x32/apps
LINUX_ICON_DIR_128 := $(LINUX_ICON_BASE)/128x128/apps
LINUX_ICON_DIR_256 := $(LINUX_ICON_BASE)/256x256/apps
LINUX_BIN_DIR := $(PREFIX)/bin
LINUX_DESKTOP_FILE := $(LINUX_DESKTOP_DIR)/$(APP_ID).desktop
LINUX_LEGACY_DESKTOP_FILE := $(LINUX_DESKTOP_DIR)/$(LEGACY_APP_ID).desktop
LINUX_ICON_FILE_32 := $(LINUX_ICON_DIR_32)/$(APP_ID).png
LINUX_ICON_FILE_128 := $(LINUX_ICON_DIR_128)/$(APP_ID).png
LINUX_ICON_FILE_256 := $(LINUX_ICON_DIR_256)/$(APP_ID).png
LINUX_LEGACY_ICON_FILE_32 := $(LINUX_ICON_DIR_32)/$(LEGACY_APP_ID).png
LINUX_LEGACY_ICON_FILE_128 := $(LINUX_ICON_DIR_128)/$(LEGACY_APP_ID).png
LINUX_LEGACY_ICON_FILE_256 := $(LINUX_ICON_DIR_256)/$(LEGACY_APP_ID).png

MACOS_APP_DIR ?= $(HOME)/Applications
MACOS_BUNDLE := $(TAURI_DIR)/target/release/bundle/macos/$(APP_NAME).app

WINDOWS_INSTALL_DIR ?= $(LOCALAPPDATA)/Programs/$(APP_NAME)
WINDOWS_START_MENU ?= $(APPDATA)/Microsoft/Windows/Start Menu/Programs

.PHONY: help all setup check build build-bin build-all build-all-strict build-linux build-macos build-windows \
	build-target-% install install-linux install-macos install-windows uninstall uninstall-linux uninstall-macos uninstall-windows

help:
	@printf '%s\n' \
		'Targets:' \
		'  make setup          Install JS dependencies' \
		'  make check          Run frontend and Rust checks' \
		'  make build          Build current platform bundles' \
		'  make build-bin      Build current platform binary only' \
		'  make build-all      Build configured targets, installing Rust std targets when possible' \
		'  make build-all-strict Build every listed target, failing on missing cross setup' \
		'  make install        Build and install for the current host user' \
		'  make uninstall      Remove the current host user install' \
		'' \
		'Variables:' \
		'  TARGET=<triple>     Build/install a specific Rust target' \
		'  BUNDLES="deb rpm"   Override Tauri bundle formats' \
		'  STRICT=1            Fail instead of skipping unavailable cross targets' \
		'  PREFIX=$(HOME)/.local'

all: build-all

setup:
	pnpm install

check:
	pnpm build
	cd $(TAURI_DIR) && cargo check

build:
	pnpm tauri build $(TARGET_ARG) --bundles $(BUNDLES)

build-bin:
	pnpm tauri build $(TARGET_ARG) --no-bundle

build-all: $(addprefix build-target-,$(ALL_TARGETS))

build-all-strict:
	$(MAKE) STRICT=1 build-all

build-linux: $(addprefix build-target-,$(LINUX_TARGETS))

build-macos: $(addprefix build-target-,$(MACOS_TARGETS))

build-windows: $(addprefix build-target-,$(WINDOWS_TARGETS))

build-target-%:
	@target='$*'; \
	if [ "$(STRICT)" != "1" ] && [ "$$target" != "$(HOST_TARGET)" ]; then \
		if ! ls "$(RUST_SYSROOT)/lib/rustlib/$$target/lib"/libcore-*.rlib >/dev/null 2>&1; then \
			if command -v rustup >/dev/null 2>&1; then \
				rustup target add "$$target"; \
			else \
				echo "Missing Rust std target: $$target"; \
				echo "Install rustup, then run: rustup target add $$target"; \
				exit 1; \
			fi; \
		fi; \
		case "$$target:$(HOST_TARGET)" in \
			*-apple-darwin:*|*-unknown-linux-gnu:*-unknown-linux-gnu|*-pc-windows-msvc:*) ;; \
			*) echo "Missing cross build toolchain for $$target on $(HOST_TARGET)."; exit 1 ;; \
		esac; \
		case "$$target" in \
			*-unknown-linux-gnu) \
				if [ -z "$$PKG_CONFIG" ] && [ -z "$$PKG_CONFIG_ALLOW_CROSS" ] && [ -z "$$PKG_CONFIG_SYSROOT_DIR" ] && [ -z "$$TARGET_PKG_CONFIG_SYSROOT_DIR" ]; then \
					echo "Skipping $$target: GTK/WebKit pkg-config sysroot is not configured."; \
					exit 0; \
				fi ;; \
		esac; \
	fi; \
	case "$$target" in \
		*-apple-darwin) cd "$(TAURI_DIR)" && cargo build --release --target "$$target" ;; \
		*-pc-windows-msvc) \
			if [ "$(OS)" = "Windows_NT" ]; then \
				pnpm tauri build --target "$$target" --no-bundle; \
			else \
				if ! cargo xwin --version >/dev/null 2>&1; then \
					cargo install cargo-xwin --locked; \
				fi; \
				clang=$$(command -v clang || true); \
				clang_cl=$$(command -v clang-cl || true); \
				lld_link=$$(command -v lld-link || true); \
				llvm_rc=$$(command -v llvm-rc || true); \
				if [ -z "$$llvm_rc" ] && [ -x "$(XWIN_TOOLS_DIR)/llvm-pkg/usr/bin/llvm-rc" ]; then \
					llvm_rc="$(XWIN_TOOLS_DIR)/llvm-pkg/usr/bin/llvm-rc"; \
				fi; \
				if [ -z "$$llvm_rc" ]; then \
					if command -v pacman >/dev/null 2>&1 && command -v curl >/dev/null 2>&1 && command -v bsdtar >/dev/null 2>&1; then \
						echo "Downloading LLVM resource compiler (llvm-rc)."; \
						mkdir -p "$(XWIN_TOOLS_DIR)/llvm-pkg"; \
						llvm_pkg_url=$$(pacman -Sp llvm 2>/dev/null | tail -n 1); \
						if [ -n "$$llvm_pkg_url" ]; then \
							curl --fail --location "$$llvm_pkg_url" --output "$(XWIN_TOOLS_DIR)/llvm.pkg.tar.zst" && \
							bsdtar -xf "$(XWIN_TOOLS_DIR)/llvm.pkg.tar.zst" -C "$(XWIN_TOOLS_DIR)/llvm-pkg" usr/bin/llvm-rc && \
							chmod 755 "$(XWIN_TOOLS_DIR)/llvm-pkg/usr/bin/llvm-rc"; \
						fi; \
						if [ -x "$(XWIN_TOOLS_DIR)/llvm-pkg/usr/bin/llvm-rc" ]; then \
							llvm_rc="$(XWIN_TOOLS_DIR)/llvm-pkg/usr/bin/llvm-rc"; \
						fi; \
					fi; \
				fi; \
				if [ -z "$$llvm_rc" ]; then \
					echo "Installing missing LLVM resource compiler (llvm-rc)."; \
					if command -v pacman >/dev/null 2>&1; then \
						if [ "$$(id -u)" = "0" ]; then pacman -S --needed --noconfirm llvm; else sudo pacman -S --needed llvm; fi; \
					elif command -v apt-get >/dev/null 2>&1; then \
						if [ "$$(id -u)" = "0" ]; then apt-get update && apt-get install -y llvm; else sudo apt-get update && sudo apt-get install -y llvm; fi; \
					elif command -v dnf >/dev/null 2>&1; then \
						if [ "$$(id -u)" = "0" ]; then dnf install -y llvm; else sudo dnf install -y llvm; fi; \
					elif command -v zypper >/dev/null 2>&1; then \
						if [ "$$(id -u)" = "0" ]; then zypper --non-interactive install llvm; else sudo zypper install llvm; fi; \
					elif command -v brew >/dev/null 2>&1; then \
						brew install llvm; \
					fi; \
					llvm_rc=$$(command -v llvm-rc || true); \
				fi; \
				if [ -z "$$clang" ] || [ -z "$$clang_cl" ] || [ -z "$$lld_link" ] || [ -z "$$llvm_rc" ]; then \
					echo "Missing LLVM tools for Windows MSVC cross builds."; \
					echo "Required: clang, clang-cl, lld-link, llvm-rc."; \
					echo "On Arch Linux, run: sudo pacman -S --needed clang lld llvm"; \
					exit 1; \
				fi; \
				mkdir -p "$(XWIN_TOOLS_DIR)"; \
				{ \
					echo '#!/usr/bin/env bash'; \
					echo 'args=()'; \
					echo 'for arg in "$$@"; do'; \
					echo '  if [ "$$arg" = /imsvc ]; then arg=-isystem; fi'; \
					echo '  args+=("$$arg")'; \
					echo 'done'; \
					printf 'exec %s "$${args[@]}"\n' "$$clang"; \
				} > "$(XWIN_TOOLS_DIR)/clang"; \
				{ echo '#!/bin/sh'; printf 'exec %s "$$@"\n' "$$clang_cl"; } > "$(XWIN_TOOLS_DIR)/clang-cl"; \
				{ echo '#!/bin/sh'; printf 'exec %s "$$@"\n' "$$lld_link"; } > "$(XWIN_TOOLS_DIR)/lld-link"; \
				{ echo '#!/bin/sh'; printf 'exec %s "$$@"\n' "$$llvm_rc"; } > "$(XWIN_TOOLS_DIR)/llvm-rc"; \
				{ echo '#!/bin/sh'; printf 'exec %s /lib "$$@"\n' "$$lld_link"; } > "$(XWIN_TOOLS_DIR)/llvm-lib"; \
				chmod 755 "$(XWIN_TOOLS_DIR)/clang" "$(XWIN_TOOLS_DIR)/clang-cl" "$(XWIN_TOOLS_DIR)/lld-link" "$(XWIN_TOOLS_DIR)/llvm-rc" "$(XWIN_TOOLS_DIR)/llvm-lib"; \
				env_target=$$(printf '%s' "$$target" | tr '-' '_'); \
				env_target_upper=$$(printf '%s' "$$env_target" | tr '[:lower:]' '[:upper:]'); \
				pnpm build && cd "$(TAURI_DIR)" && \
					env \
					"PATH=$(XWIN_TOOLS_DIR):$$PATH" \
					"TARGET_CC=$(XWIN_TOOLS_DIR)/clang-cl" \
					"TARGET_AR=$(XWIN_TOOLS_DIR)/llvm-lib" \
					"RC=$(XWIN_TOOLS_DIR)/llvm-rc" \
					"CARGO_TARGET_$${env_target_upper}_LINKER=$(XWIN_TOOLS_DIR)/lld-link" \
					"CC_$${env_target}=$(XWIN_TOOLS_DIR)/clang-cl" \
					"AR_$${env_target}=$(XWIN_TOOLS_DIR)/llvm-lib" \
					"RC_$${env_target}=$(XWIN_TOOLS_DIR)/llvm-rc" \
					cargo xwin build --release --target "$$target"; \
			fi ;; \
		*) pnpm tauri build --target "$$target" --no-bundle ;; \
	esac

install:
	$(MAKE) $(CURRENT_INSTALL)

install-linux: build-bin
	install -d "$(LINUX_APP_DIR)" "$(LINUX_DESKTOP_DIR)" "$(LINUX_ICON_DIR_32)" "$(LINUX_ICON_DIR_128)" "$(LINUX_ICON_DIR_256)" "$(LINUX_BIN_DIR)"
	install -m 755 "$(BUILT_BIN)" "$(LINUX_APP_DIR)/$(BIN_NAME).new"
	mv -f "$(LINUX_APP_DIR)/$(BIN_NAME).new" "$(LINUX_APP_DIR)/$(BIN_NAME)"
	rm -f "$(LINUX_BIN_DIR)/$(BIN_NAME)"
	ln -sfn "$(LINUX_APP_DIR)/$(BIN_NAME)" "$(LINUX_BIN_DIR)/$(BIN_NAME)"
	install -m 644 "$(ICON_SRC_32)" "$(LINUX_ICON_FILE_32).new"
	mv -f "$(LINUX_ICON_FILE_32).new" "$(LINUX_ICON_FILE_32)"
	install -m 644 "$(ICON_SRC)" "$(LINUX_ICON_FILE_128).new"
	mv -f "$(LINUX_ICON_FILE_128).new" "$(LINUX_ICON_FILE_128)"
	install -m 644 "$(ICON_SRC_256)" "$(LINUX_ICON_FILE_256).new"
	mv -f "$(LINUX_ICON_FILE_256).new" "$(LINUX_ICON_FILE_256)"
	rm -f "$(LINUX_ICON_BASE)/scalable/apps/$(APP_ID).svg" "$(LINUX_LEGACY_DESKTOP_FILE)" "$(LINUX_LEGACY_ICON_FILE_32)" "$(LINUX_LEGACY_ICON_FILE_128)" "$(LINUX_LEGACY_ICON_FILE_256)" "$(LINUX_ICON_BASE)/scalable/apps/$(LEGACY_APP_ID).svg"
	{ \
		echo '[Desktop Entry]'; \
		echo 'Type=Application'; \
		echo 'Name=$(APP_NAME)'; \
		echo 'Comment=Markdown notes editor'; \
		echo 'Exec=$(LINUX_APP_DIR)/$(BIN_NAME)'; \
		echo 'Icon=$(APP_ID)'; \
		echo 'Terminal=false'; \
		echo 'Categories=Utility;TextEditor;'; \
		echo 'StartupNotify=true'; \
	} > "$(LINUX_DESKTOP_FILE).new"
	mv -f "$(LINUX_DESKTOP_FILE).new" "$(LINUX_DESKTOP_FILE)"
	chmod 644 "$(LINUX_DESKTOP_FILE)"
	rm -f "$(HOME)/.cache/ksycoca6"* "$(HOME)/.cache/icon-cache.kcache"
	if command -v xdg-icon-resource >/dev/null; then xdg-icon-resource forceupdate; fi
	if command -v update-desktop-database >/dev/null; then update-desktop-database "$(LINUX_DESKTOP_DIR)"; fi
	if command -v gtk-update-icon-cache >/dev/null && [ -f "$(LINUX_ICON_BASE)/index.theme" ]; then gtk-update-icon-cache -q "$(LINUX_ICON_BASE)"; fi
	if command -v kbuildsycoca6 >/dev/null; then kbuildsycoca6 --noincremental; fi
	if command -v kbuildsycoca5 >/dev/null; then kbuildsycoca5 --noincremental; fi
	if command -v xdg-desktop-menu >/dev/null; then xdg-desktop-menu forceupdate; fi

install-macos: build
	install -d "$(MACOS_APP_DIR)"
	rm -rf "$(MACOS_APP_DIR)/$(APP_NAME).app"
	cp -R "$(MACOS_BUNDLE)" "$(MACOS_APP_DIR)/"

install-windows: build-bin
	mkdir -p "$(WINDOWS_INSTALL_DIR)"
	cp "$(BUILT_BIN)" "$(WINDOWS_INSTALL_DIR)/$(BIN_NAME).exe"
	powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$w = New-Object -ComObject WScript.Shell; $$s = $$w.CreateShortcut('$(WINDOWS_START_MENU)/$(APP_NAME).lnk'); $$s.TargetPath = '$(WINDOWS_INSTALL_DIR)/$(BIN_NAME).exe'; $$s.WorkingDirectory = '$(WINDOWS_INSTALL_DIR)'; $$s.Save()"

uninstall:
	$(MAKE) $(CURRENT_UNINSTALL)

uninstall-linux:
	rm -f "$(LINUX_BIN_DIR)/$(BIN_NAME)" "$(LINUX_DESKTOP_FILE)" "$(LINUX_LEGACY_DESKTOP_FILE)" "$(LINUX_ICON_FILE_32)" "$(LINUX_ICON_FILE_128)" "$(LINUX_ICON_FILE_256)" "$(LINUX_ICON_BASE)/scalable/apps/$(APP_ID).svg" "$(LINUX_LEGACY_ICON_FILE_32)" "$(LINUX_LEGACY_ICON_FILE_128)" "$(LINUX_LEGACY_ICON_FILE_256)" "$(LINUX_ICON_BASE)/scalable/apps/$(LEGACY_APP_ID).svg"
	rm -rf "$(LINUX_APP_DIR)"
	rm -f "$(HOME)/.cache/ksycoca6"* "$(HOME)/.cache/icon-cache.kcache"
	if command -v xdg-icon-resource >/dev/null; then xdg-icon-resource forceupdate; fi
	if command -v update-desktop-database >/dev/null; then update-desktop-database "$(LINUX_DESKTOP_DIR)"; fi
	if command -v gtk-update-icon-cache >/dev/null && [ -f "$(LINUX_ICON_BASE)/index.theme" ]; then gtk-update-icon-cache -q "$(LINUX_ICON_BASE)"; fi
	if command -v kbuildsycoca6 >/dev/null; then kbuildsycoca6 --noincremental; fi
	if command -v kbuildsycoca5 >/dev/null; then kbuildsycoca5 --noincremental; fi
	if command -v xdg-desktop-menu >/dev/null; then xdg-desktop-menu forceupdate; fi

uninstall-macos:
	rm -rf "$(MACOS_APP_DIR)/$(APP_NAME).app"

uninstall-windows:
	@if [ "$(OS)" = "Windows_NT" ]; then \
		rm -f "$(WINDOWS_START_MENU)/$(APP_NAME).lnk"; \
		rm -rf "$(WINDOWS_INSTALL_DIR)"; \
	else \
		echo "Skipping Windows uninstall on this host."; \
	fi
