SHELL := /bin/sh

APP_NAME := MemoSmith
APP_ID := dev.clustrx.memosmith
BIN_NAME := memosmith
TAURI_DIR := src-tauri
ICON_SRC := $(TAURI_DIR)/icons/128x128.png

UNAME_S := $(shell uname -s 2>/dev/null || echo Windows_NT)
HOST_TARGET := $(shell rustc -vV 2>/dev/null | sed -n 's/^host: //p')
RUST_SYSROOT := $(shell rustc --print sysroot 2>/dev/null)
PREFIX ?= $(HOME)/.local
STRICT ?= 0

ifeq ($(UNAME_S),Darwin)
BUNDLES ?= app dmg
CURRENT_INSTALL := install-macos
else ifeq ($(OS),Windows_NT)
BUNDLES ?= nsis msi
CURRENT_INSTALL := install-windows
else
BUNDLES ?= deb rpm
CURRENT_INSTALL := install-linux
endif

TARGET ?=
TARGET_ARG := $(if $(TARGET),--target $(TARGET),)
TARGET_DIR := $(if $(TARGET),$(TAURI_DIR)/target/$(TARGET)/release,$(TAURI_DIR)/target/release)
BIN_EXT := $(if $(filter $(OS),Windows_NT),.exe,)
BUILT_BIN := $(TARGET_DIR)/$(BIN_NAME)$(BIN_EXT)

LINUX_TARGETS := x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu
MACOS_TARGETS := x86_64-apple-darwin aarch64-apple-darwin universal-apple-darwin
WINDOWS_TARGETS := x86_64-pc-windows-msvc aarch64-pc-windows-msvc i686-pc-windows-msvc
ALL_TARGETS := $(LINUX_TARGETS) $(MACOS_TARGETS) $(WINDOWS_TARGETS)

LINUX_APP_DIR := $(PREFIX)/share/$(BIN_NAME)
LINUX_DESKTOP_DIR := $(PREFIX)/share/applications
LINUX_ICON_DIR := $(PREFIX)/share/icons/hicolor/128x128/apps
LINUX_BIN_DIR := $(PREFIX)/bin
LINUX_DESKTOP_FILE := $(LINUX_DESKTOP_DIR)/$(APP_ID).desktop

MACOS_APP_DIR ?= $(HOME)/Applications
MACOS_BUNDLE := $(TAURI_DIR)/target/release/bundle/macos/$(APP_NAME).app

WINDOWS_INSTALL_DIR ?= $(LOCALAPPDATA)/Programs/$(APP_NAME)
WINDOWS_START_MENU ?= $(APPDATA)/Microsoft/Windows/Start Menu/Programs

.PHONY: help all setup check build build-bin build-all build-all-strict build-linux build-macos build-windows \
	build-target-% install install-linux install-macos install-windows uninstall

help:
	@printf '%s\n' \
		'Targets:' \
		'  make setup          Install JS dependencies' \
		'  make check          Run frontend and Rust checks' \
		'  make build          Build current platform bundles' \
		'  make build-bin      Build current platform binary only' \
		'  make build-all      Build configured targets, skipping unavailable cross targets' \
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
			echo "Skipping $$target: Rust std target is not installed."; \
			exit 0; \
		fi; \
		case "$$target:$(HOST_TARGET)" in \
			universal-apple-darwin:*-apple-darwin|*-apple-darwin:*-apple-darwin|*-unknown-linux-gnu:*-unknown-linux-gnu|*-pc-windows-msvc:*-pc-windows-msvc) ;; \
			*) echo "Skipping $$target: Tauri desktop builds for that OS need that OS/toolchain."; exit 0 ;; \
		esac; \
		case "$$target" in \
			*-unknown-linux-gnu) \
				if [ -z "$$PKG_CONFIG" ] && [ -z "$$PKG_CONFIG_ALLOW_CROSS" ] && [ -z "$$PKG_CONFIG_SYSROOT_DIR" ] && [ -z "$$TARGET_PKG_CONFIG_SYSROOT_DIR" ]; then \
					echo "Skipping $$target: GTK/WebKit pkg-config sysroot is not configured."; \
					exit 0; \
				fi ;; \
		esac; \
	fi; \
	pnpm tauri build --target "$$target" --no-bundle

install: build
	$(MAKE) $(CURRENT_INSTALL)

install-linux:
	install -d "$(LINUX_APP_DIR)" "$(LINUX_DESKTOP_DIR)" "$(LINUX_ICON_DIR)" "$(LINUX_BIN_DIR)"
	install -m 755 "$(BUILT_BIN)" "$(LINUX_APP_DIR)/$(BIN_NAME)"
	ln -sfn "$(LINUX_APP_DIR)/$(BIN_NAME)" "$(LINUX_BIN_DIR)/$(BIN_NAME)"
	install -m 644 "$(ICON_SRC)" "$(LINUX_ICON_DIR)/$(APP_ID).png"
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
	} > "$(LINUX_DESKTOP_FILE)"
	chmod 644 "$(LINUX_DESKTOP_FILE)"
	if command -v update-desktop-database >/dev/null; then update-desktop-database "$(LINUX_DESKTOP_DIR)"; fi
	if command -v kbuildsycoca6 >/dev/null; then kbuildsycoca6 --noincremental; fi
	if command -v kbuildsycoca5 >/dev/null; then kbuildsycoca5 --noincremental; fi

install-macos:
	install -d "$(MACOS_APP_DIR)"
	rm -rf "$(MACOS_APP_DIR)/$(APP_NAME).app"
	cp -R "$(MACOS_BUNDLE)" "$(MACOS_APP_DIR)/"

install-windows:
	mkdir -p "$(WINDOWS_INSTALL_DIR)"
	cp "$(BUILT_BIN)" "$(WINDOWS_INSTALL_DIR)/$(BIN_NAME).exe"
	powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$w = New-Object -ComObject WScript.Shell; $$s = $$w.CreateShortcut('$(WINDOWS_START_MENU)/$(APP_NAME).lnk'); $$s.TargetPath = '$(WINDOWS_INSTALL_DIR)/$(BIN_NAME).exe'; $$s.WorkingDirectory = '$(WINDOWS_INSTALL_DIR)'; $$s.Save()"

uninstall:
	rm -f "$(LINUX_BIN_DIR)/$(BIN_NAME)" "$(LINUX_DESKTOP_FILE)" "$(LINUX_ICON_DIR)/$(APP_ID).png"
	rm -rf "$(LINUX_APP_DIR)" "$(MACOS_APP_DIR)/$(APP_NAME).app"
