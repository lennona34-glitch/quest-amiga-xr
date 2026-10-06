"""Desktop Shortcut Icon Editor.

Pick a .lnk shortcut from your desktop, give it new art (your own image or
AI-generated via Hugging Face FLUX.1-schnell / Black Forest Labs FLUX), strip
the background to transparent, and apply it as the shortcut's icon.
"""
import base64
import ctypes
import io
import json
import os
import subprocess
import sys
import threading
import time
import tkinter as tk
import urllib.error
import urllib.request
from tkinter import filedialog, messagebox, ttk

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageTk

APP_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "ShortcutEditor")
ICON_DIR = os.path.join(APP_DIR, "icons")
CONFIG = os.path.join(APP_DIR, "config.json")
BLANK_ICO = os.path.join(APP_DIR, "blank.ico")
ICO_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
HF_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"
BFL_MODELS = {"BFL FLUX 1.1 pro": "flux-pro-1.1", "BFL FLUX dev": "flux-dev"}
PROVIDERS = ["HuggingFace FLUX.1-schnell"] + list(BFL_MODELS)
PROMPT_WRAP = ("{p}, app icon, single centered subject, bold clean shapes, "
               "isolated on a plain solid white background, no text, no border")

os.makedirs(ICON_DIR, exist_ok=True)


# ---------- config ----------
def load_config():
    try:
        with open(CONFIG, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_config(cfg):
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


# ---------- shortcuts (via PowerShell / WScript.Shell, no extra deps) ----------
def ps(script, env=None):
    e = dict(os.environ, **(env or {}))
    r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                       capture_output=True, text=True, env=e, creationflags=0x08000000)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "PowerShell failed")
    return r.stdout


def list_items():
    """Desktop shortcuts (.lnk) and folders, as dicts with kind = 'lnk' | 'folder'."""
    out = ps(r"""
$sh = New-Object -ComObject WScript.Shell
$dirs = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'))
$r = @(foreach ($d in $dirs) { if (Test-Path $d) { Get-ChildItem $d -Filter *.lnk | ForEach-Object {
  $s = $sh.CreateShortcut($_.FullName)
  [pscustomobject]@{ kind = 'lnk'; path = $_.FullName; name = $_.BaseName; target = $s.TargetPath; icon = $s.IconLocation } } } })
ConvertTo-Json -InputObject $r -Compress""")
    items = json.loads(out) if out.strip() else []
    if isinstance(items, dict):
        items = [items]
    dirs = json.loads(ps(r"ConvertTo-Json -InputObject @([Environment]::GetFolderPath('Desktop'),"
                         r"[Environment]::GetFolderPath('CommonDesktopDirectory')) -Compress"))
    for d in dirs:
        if not os.path.isdir(d):
            continue
        for e in os.scandir(d):
            if e.is_dir() and not (e.stat().st_file_attributes & 0x6):  # skip hidden/system folders
                items.append({"kind": "folder", "path": e.path, "name": e.name,
                              "target": e.path, "icon": folder_icon(e.path) or "(default folder icon)"})
    return sorted(items, key=lambda i: (i["kind"] != "folder", i["name"].lower()))


def refresh_shell():
    ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x1000, None, None)


def set_icon_location(lnk, loc):
    ps(r"$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); "
       r"$s.IconLocation=$env:LOC; $s.Save()", {"LNK": lnk, "LOC": loc})
    refresh_shell()


# ---------- folder icons (desktop.ini) ----------
_ICON_KEYS = ("IconResource", "IconFile", "IconIndex")


def _read_ini(path):
    for enc in ("utf-16", "utf-8-sig", "mbcs"):
        try:
            with open(path, encoding=enc) as f:
                return f.read()
        except (UnicodeError, OSError):
            continue
    return ""


def _parse_shellclass(text):
    """Return (other_lines, {key: value}) for the [.ShellClassInfo] section."""
    other, info, in_sec = [], {}, False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("["):
            in_sec = s.lower() == "[.shellclassinfo]"
            if not in_sec:
                other.append(line)
            continue
        if in_sec and "=" in s:
            k, v = s.split("=", 1)
            info[k.strip()] = v.strip()
        elif not in_sec:
            other.append(line)
    return other, info


def folder_icon(folder):
    ini = os.path.join(folder, "desktop.ini")
    if not os.path.isfile(ini):
        return None
    _, info = _parse_shellclass(_read_ini(ini))
    return info.get("IconResource") or (info.get("IconFile", "") + "," + info.get("IconIndex", "0")
                                        if info.get("IconFile") else None)


def _write_ini(folder, info, other):
    ini = os.path.join(folder, "desktop.ini")
    k32 = ctypes.windll.kernel32
    if os.path.exists(ini):
        k32.SetFileAttributesW(ini, 0x80)  # make writable
    body = "\r\n".join(["[.ShellClassInfo]"] + [f"{k}={v}" for k, v in info.items()]
                       + [l for l in other if l.strip() or True]) + "\r\n"
    with open(ini, "w", encoding="utf-16", newline="") as f:
        f.write(body)
    k32.SetFileAttributesW(ini, 0x2 | 0x4)  # hidden + system
    attrs = k32.GetFileAttributesW(folder)
    k32.SetFileAttributesW(folder, attrs | 0x1)  # read-only flag makes Explorer honour desktop.ini
    refresh_shell()


def set_folder_icon(folder, ico):
    ini = os.path.join(folder, "desktop.ini")
    other, info = _parse_shellclass(_read_ini(ini)) if os.path.isfile(ini) else ([], {})
    saved = {k: info.pop(k) for k in _ICON_KEYS if k in info}
    info["IconResource"] = f"{ico},0"
    _write_ini(folder, info, other)
    return saved


def restore_folder_icon(folder, saved):
    ini = os.path.join(folder, "desktop.ini")
    other, info = _parse_shellclass(_read_ini(ini)) if os.path.isfile(ini) else ([], {})
    for k in _ICON_KEYS:
        info.pop(k, None)
    info.update(saved or {})
    if not info and not any(l.strip() for l in other):
        if os.path.exists(ini):
            ctypes.windll.kernel32.SetFileAttributesW(ini, 0x80)
            os.remove(ini)
        k32 = ctypes.windll.kernel32
        k32.SetFileAttributesW(folder, k32.GetFileAttributesW(folder) & ~0x1)
        refresh_shell()
    else:
        _write_ini(folder, info, other)


# ---------- image processing ----------
def remove_background(img, tol):
    """Flood-fill from the corners/edges; everything connected to the backdrop goes transparent."""
    img = img.convert("RGBA")
    if img.getchannel("A").getextrema()[0] < 250:
        return img  # already has real transparency
    try:  # best quality if the user has rembg installed
        from rembg import remove  # type: ignore
        return remove(img)
    except Exception:
        pass
    rgb = img.convert("RGB")
    w, h = rgb.size
    marker = (255, 0, 254)
    work = rgb.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        if work.getpixel(s) != marker:
            ImageDraw.floodfill(work, s, marker, thresh=tol)
    bg = Image.new("RGB", (w, h), marker)
    diff = ImageChops.difference(work, bg).convert("L")
    alpha = diff.point(lambda v: 255 if v > 0 else 0)  # 255 = subject
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    img.putalpha(alpha)
    return img


def square_icon(img, pad_pct):
    """Crop to content, pad to a transparent square."""
    bbox = img.getchannel("A").getbbox()
    if bbox:
        img = img.crop(bbox)
    side = max(img.size)
    pad = int(side * pad_pct / 100)
    canvas = Image.new("RGBA", (side + pad * 2,) * 2, (0, 0, 0, 0))
    canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2), img)
    return canvas.resize((256, 256), Image.LANCZOS)


def save_ico(img, path):
    img.save(path, format="ICO", sizes=ICO_SIZES)


# ---------- image generation ----------
def http(url, data=None, headers=None, method=None, timeout=180):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read()[:300].decode('utf-8', 'replace')}")


def generate(provider, prompt, cfg):
    full = PROMPT_WRAP.format(p=prompt)
    if provider.startswith("HuggingFace"):
        key = cfg.get("hf_key") or os.environ.get("HF_TOKEN")
        if not key:
            raise RuntimeError("Add a Hugging Face token in Settings (or set HF_TOKEN).")
        body = json.dumps({"inputs": full}).encode()
        raw = http(HF_URL, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                  "Accept": "image/png"}, "POST")
        return Image.open(io.BytesIO(raw))
    key = cfg.get("bfl_key") or os.environ.get("BFL_API_KEY")
    if not key:
        raise RuntimeError("Add a Black Forest Labs key in Settings (or set BFL_API_KEY).")
    model = BFL_MODELS[provider]
    hdr = {"x-key": key, "Content-Type": "application/json", "accept": "application/json"}
    job = json.loads(http(f"https://api.bfl.ai/v1/{model}",
                          json.dumps({"prompt": full, "width": 1024, "height": 1024}).encode(), hdr, "POST"))
    poll = job.get("polling_url") or f"https://api.bfl.ai/v1/get_result?id={job['id']}"
    for _ in range(90):
        time.sleep(1.5)
        res = json.loads(http(poll, headers={"x-key": key, "accept": "application/json"}))
        if res.get("status") == "Ready":
            return Image.open(io.BytesIO(http(res["result"]["sample"])))
        if res.get("status") in ("Error", "Failed", "Request Moderated", "Content Moderated"):
            raise RuntimeError(f"Generation failed: {res.get('status')}")
    raise RuntimeError("Timed out waiting for image.")


# ---------- shortcut arrow overlay (system-wide, needs admin) ----------
ARROW_KEY = r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Icons"


def arrow_override():
    r = subprocess.run(["reg", "query", ARROW_KEY, "/v", "29"], capture_output=True, text=True,
                       creationflags=0x08000000)
    return r.returncode == 0


def run_admin(cmd):
    # elevated processes do NOT inherit our env vars, so pass the command encoded on the command line
    enc = base64.b64encode(cmd.encode("utf-16-le")).decode()
    ps(f"Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden "
       f"-ArgumentList '-NoProfile','-EncodedCommand','{enc}'")


def hide_arrows():
    Image.new("RGBA", (32, 32), (0, 0, 0, 0)).save(BLANK_ICO, format="ICO", sizes=[(32, 32)])
    run_admin(f'reg add "{ARROW_KEY}" /v 29 /t REG_SZ /d "{BLANK_ICO},0" /f')
    if not arrow_override():
        raise RuntimeError("The registry value was not written (was the admin prompt declined?).")


def restore_arrows():
    run_admin(f'reg delete "{ARROW_KEY}" /v 29 /f')
    if arrow_override():
        raise RuntimeError("The registry value is still present (was the admin prompt declined?).")


def restart_explorer():
    subprocess.run(["taskkill", "/f", "/im", "explorer.exe"], capture_output=True, creationflags=0x08000000)
    subprocess.Popen(["explorer.exe"])


# ---------- GUI ----------
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Shortcut Icon Editor")
        self.geometry("900x620")
        self.cfg = load_config()
        self.shortcuts = []
        self.source = None      # raw PIL image (loaded or generated)
        self.processed = None   # 256x256 RGBA result
        self.tkimg = None
        self._theme()
        self._build()
        self.refresh()

    def _theme(self):
        bg, panel, fg, acc = "#1e1f24", "#2a2c33", "#e6e6e6", "#4f8cff"
        self.configure(bg=bg)
        st = ttk.Style(self)
        st.theme_use("clam")
        st.configure(".", background=bg, foreground=fg, fieldbackground=panel, bordercolor="#3a3d46",
                     lightcolor=panel, darkcolor=panel, troughcolor=panel, insertcolor=fg)
        st.configure("TButton", background=panel, padding=5)
        st.map("TButton", background=[("active", "#383b45"), ("disabled", bg)],
               foreground=[("disabled", "#777")])
        st.configure("TLabelframe", background=bg, bordercolor="#3a3d46")
        st.configure("TLabelframe.Label", background=bg, foreground=fg)
        st.configure("TEntry", fieldbackground=panel, foreground=fg)
        st.configure("TCombobox", fieldbackground=panel, background=panel, foreground=fg, arrowcolor=fg)
        st.map("TCombobox", fieldbackground=[("readonly", panel)], foreground=[("readonly", fg)])
        st.configure("TCheckbutton", background=bg, indicatorcolor=panel)
        st.map("TCheckbutton", indicatorcolor=[("selected", acc)], background=[("active", bg)])
        st.configure("Horizontal.TScale", background=bg, troughcolor=panel)
        st.configure("Muted.TLabel", foreground="#9aa0aa")
        self.option_add("*TCombobox*Listbox.background", panel)
        self.option_add("*TCombobox*Listbox.foreground", fg)
        self.colors = dict(bg=bg, panel=panel, fg=fg, acc=acc)
        try:  # dark title bar
            self.update()
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(ctypes.c_int(1)), 4)
        except Exception:
            pass

    def _build(self):
        c = self.colors
        left = ttk.Frame(self, padding=8)
        left.pack(side="left", fill="y")
        ttk.Label(left, text="Shortcuts & folders").pack(anchor="w")
        self.lb = tk.Listbox(left, width=30, exportselection=False, bg=c["panel"], fg=c["fg"],
                             selectbackground=c["acc"], selectforeground="#fff", highlightthickness=0,
                             borderwidth=0, activestyle="none")
        self.lb.pack(fill="y", expand=True)
        self.lb.bind("<<ListboxSelect>>", self.on_select)
        ttk.Button(left, text="Refresh", command=self.refresh).pack(fill="x", pady=(6, 0))
        ttk.Button(left, text="Settings / API keys…", command=self.settings).pack(fill="x", pady=2)
        ttk.Separator(left).pack(fill="x", pady=6)
        ttk.Button(left, text="Hide ALL shortcut arrows…", command=self.do_hide).pack(fill="x")
        ttk.Button(left, text="Restore shortcut arrows…", command=self.do_restore).pack(fill="x", pady=2)
        ttk.Button(left, text="Restart Explorer (refresh)", command=self.do_restart).pack(fill="x")

        right = ttk.Frame(self, padding=8)
        right.pack(side="left", fill="both", expand=True)
        self.info = ttk.Label(right, text="Select a shortcut", wraplength=560, justify="left")
        self.info.pack(anchor="w")

        self.canvas = tk.Canvas(right, width=256, height=256, highlightthickness=1,
                                highlightbackground="#3a3d46", bg=c["bg"])
        self.canvas.pack(pady=8)
        self.draw_preview()

        row = ttk.Frame(right)
        row.pack(fill="x")
        ttk.Button(row, text="Load image…", command=self.load_image).pack(side="left")
        ttk.Label(row, text="  or generate:").pack(side="left")
        self.provider = ttk.Combobox(row, values=PROVIDERS, state="readonly", width=26)
        self.provider.current(0)
        self.provider.pack(side="left", padx=4)

        self.prompt = tk.StringVar()
        prow = ttk.Frame(right)
        prow.pack(fill="x", pady=4)
        ttk.Entry(prow, textvariable=self.prompt).pack(side="left", fill="x", expand=True)
        self.gen_btn = ttk.Button(prow, text="Generate", command=self.do_generate)
        self.gen_btn.pack(side="left", padx=4)

        opt = ttk.LabelFrame(right, text="Transparency", padding=6)
        opt.pack(fill="x", pady=6)
        self.rm_bg = tk.BooleanVar(value=True)
        ttk.Checkbutton(opt, text="Remove background", variable=self.rm_bg,
                        command=self.reprocess).grid(row=0, column=0, sticky="w")
        self.tol = tk.IntVar(value=40)
        self.pad = tk.IntVar(value=6)
        ttk.Label(opt, text="Tolerance").grid(row=1, column=0, sticky="w")
        ttk.Scale(opt, from_=5, to=120, variable=self.tol, command=lambda _: self.reprocess(delay=True),
                  length=240).grid(row=1, column=1)
        ttk.Label(opt, text="Padding %").grid(row=2, column=0, sticky="w")
        ttk.Scale(opt, from_=0, to=25, variable=self.pad, command=lambda _: self.reprocess(delay=True),
                  length=240).grid(row=2, column=1)

        brow = ttk.Frame(right)
        brow.pack(fill="x", pady=8)
        ttk.Button(brow, text="Apply to shortcut", command=self.apply).pack(side="left")
        ttk.Button(brow, text="Restore original icon", command=self.restore).pack(side="left", padx=6)
        self.status = ttk.Label(right, text="", style="Muted.TLabel", wraplength=560, justify="left")
        self.status.pack(anchor="w")
        self._after = None

    # -- helpers
    def say(self, msg):
        self.status.config(text=msg)

    def current(self):
        sel = self.lb.curselection()
        return self.shortcuts[sel[0]] if sel else None

    def refresh(self):
        try:
            sel = self.lb.curselection()
            self.shortcuts = list_items()
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return
        self.lb.delete(0, "end")
        for s in self.shortcuts:
            self.lb.insert("end", ("📁 " if s["kind"] == "folder" else "") + s["name"])
        if sel and sel[0] < len(self.shortcuts):
            self.lb.selection_set(sel[0])
            self.on_select()
        self.say(f"{len(self.shortcuts)} items found.")

    def on_select(self, _=None):
        s = self.current()
        if s:
            label = "Folder" if s["kind"] == "folder" else "Target"
            self.info.config(text=f"{s['name']}\n{label}: {s['target']}\nIcon: {s['icon']}")

    def draw_preview(self):
        c = self.canvas
        c.delete("all")
        for y in range(0, 256, 16):  # checkerboard so transparency is visible
            for x in range(0, 256, 16):
                c.create_rectangle(x, y, x + 16, y + 16, outline="",
                                   fill="#3c3f48" if (x + y) // 16 % 2 else "#2e3037")
        if self.processed:
            self.tkimg = ImageTk.PhotoImage(self.processed)
            c.create_image(128, 128, image=self.tkimg)

    def reprocess(self, delay=False):
        if self.source is None:
            return
        if delay:
            if self._after:
                self.after_cancel(self._after)
            self._after = self.after(250, self.reprocess)
            return
        img = self.source
        if self.rm_bg.get():
            img = remove_background(img, int(self.tol.get()))
        else:
            img = img.convert("RGBA")
        self.processed = square_icon(img, int(self.pad.get()))
        self.draw_preview()

    # -- actions
    def load_image(self):
        p = filedialog.askopenfilename(filetypes=[("Images", "*.png *.jpg *.jpeg *.webp *.bmp *.ico")])
        if p:
            self.source = Image.open(p)
            self.reprocess()

    def do_generate(self):
        if not self.prompt.get().strip():
            return
        self.gen_btn.state(["disabled"])
        self.say("Generating…")

        def work():
            try:
                img = generate(self.provider.get(), self.prompt.get().strip(), self.cfg)
                self.after(0, lambda: self.generated(img))
            except Exception as e:
                self.after(0, lambda: (self.say(f"Failed: {e}"), self.gen_btn.state(["!disabled"])))
        threading.Thread(target=work, daemon=True).start()

    def generated(self, img):
        self.source = img
        self.gen_btn.state(["!disabled"])
        self.say("Done. Adjust tolerance/padding if the edges look off.")
        self.reprocess()

    def apply(self):
        s = self.current()
        if not s or self.processed is None:
            messagebox.showinfo("Nothing to apply", "Select a shortcut and load/generate art first.")
            return
        originals = self.cfg.setdefault("originals", {})
        ico = os.path.join(ICON_DIR, f"{s['name']}_{int(time.time())}.ico".replace(" ", "_"))
        try:
            save_ico(self.processed, ico)
            if s["kind"] == "folder":
                saved = set_folder_icon(s["path"], ico)
                originals.setdefault(s["path"], saved)
            else:
                originals.setdefault(s["path"], s["icon"])
                set_icon_location(s["path"], f"{ico},0")
            save_config(self.cfg)
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return
        self.refresh()
        self.say(f"Applied to {s['name']}. If it doesn't update, use Restart Explorer.")

    def restore(self):
        s = self.current()
        if not s:
            return
        orig = self.cfg.get("originals", {}).get(s["path"])
        if orig is None and s["kind"] == "lnk":
            self.say("No saved original for this shortcut.")
            return
        if s["kind"] == "folder":
            restore_folder_icon(s["path"], orig if isinstance(orig, dict) else {})
        else:
            set_icon_location(s["path"], orig)
        self.refresh()
        self.say(f"Restored {s['name']}.")

    def settings(self):
        w = tk.Toplevel(self)
        w.title("API keys")
        w.resizable(False, False)
        w.configure(bg=self.colors["bg"])
        vars_ = {}
        for i, (k, label) in enumerate([("hf_key", "Hugging Face token"), ("bfl_key", "Black Forest Labs key")]):
            ttk.Label(w, text=label).grid(row=i, column=0, padx=8, pady=6, sticky="w")
            v = tk.StringVar(value=self.cfg.get(k, ""))
            ttk.Entry(w, textvariable=v, show="•", width=44).grid(row=i, column=1, padx=8)
            vars_[k] = v
        ttk.Label(w, text=f"Stored locally in {CONFIG}\n(env vars HF_TOKEN / BFL_API_KEY also work)",
                  style="Muted.TLabel").grid(row=2, column=0, columnspan=2, padx=8, pady=4)

        def ok():
            for k, v in vars_.items():
                self.cfg[k] = v.get().strip()
            save_config(self.cfg)
            w.destroy()
        ttk.Button(w, text="Save", command=ok).grid(row=3, column=1, sticky="e", padx=8, pady=8)

    def do_hide(self):
        if messagebox.askyesno("Hide shortcut arrows",
                               "This edits a system-wide Windows registry value (HKLM ... Shell Icons \\ 29) "
                               "and needs administrator approval. It affects every shortcut on the PC.\n\n"
                               "You'll be asked for administrator approval. Continue?"):
            try:
                hide_arrows()
            except Exception as e:
                messagebox.showerror("Error", str(e))
                return
            self.say("Arrow override written. Restart Explorer to see it.")
            if messagebox.askyesno("Done", "The arrow override was written to the registry.\n\n"
                                   "Restart Explorer now to see it? (Open File Explorer windows will close.)"):
                restart_explorer()

    def do_restore(self):
        if messagebox.askyesno("Restore arrows", "Remove the override and bring the default arrows back?"):
            try:
                restore_arrows()
            except Exception as e:
                messagebox.showerror("Error", str(e))
                return
            self.say("Arrow override removed. Restart Explorer to see it.")
            if messagebox.askyesno("Done", "Override removed.\n\nRestart Explorer now? "
                                   "(Open File Explorer windows will close.)"):
                restart_explorer()

    def do_restart(self):
        if messagebox.askyesno("Restart Explorer", "Restart Explorer to refresh icons? "
                               "Open File Explorer windows will close."):
            restart_explorer()


if __name__ == "__main__":
    App().mainloop()
