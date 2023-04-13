import { App, MarkdownView, Notice, View as OView, WorkspaceLeaf, moment } from "obsidian";
import HomepagePlugin from "./main";
import { getDailynotesAutorun, randomFile, trimFile, untrimName } from "./utils";

const LEAF_TYPES: string[] = ["markdown", "canvas", "kanban"];

export const DEFAULT: string = "Main Homepage";
export const MOBILE: string = "Mobile Homepage";

export interface HomepageData {
	[member: string]: any,
	value: string,
	kind: string,
	openOnStartup: boolean,
	hasRibbonIcon: boolean,
	openMode: string,
	manualOpenMode: string,
	view: string,
	revertView: boolean,
	refreshDataview: boolean,
	autoCreate: boolean,
	autoScroll: boolean,
	pin: boolean,
	commands: string[]
} 

export enum Mode {
	ReplaceAll = "Replace all open notes",
	ReplaceLast = "Replace last note",
	Retain = "Keep open notes"
}

export enum View {
	Default = "Default view",
	Reading = "Reading view",
	Source = "Editing view (Source)",
	LivePreview = "Editing view (Live Preview)"
}

export enum Kind {
	File = "File",
	Workspace = "Workspace",
	MomentDate = "Date-dependent file",
	Random = "Random file",
	DailyNote = "Daily Note"
}

export class Homepage {
	plugin: HomepagePlugin;
	app: App;
	data: HomepageData;
	
	name: string;
	lastView?: WeakRef<MarkdownView> = undefined;
	computedValue: string;
	
	constructor(name: string, plugin: HomepagePlugin) {
		this.name = name;
		this.plugin = plugin;
		this.app = plugin.app;
		this.data = plugin.settings.homepages[name];
	}
	
	async setReversion(value: boolean): Promise<void> {
		if (value && this.data.view !== View.Default) {
			this.plugin.registerEvent(this.app.workspace.on("layout-change", this.revertView));
		} 
		else {
			this.app.workspace.off("layout-change", this.revertView);
		}
	}
	
	async open(alternate: boolean = false): Promise<void> {
		if (!this.plugin.hasRequiredPlugin(this.data.kind as Kind)) {
			new Notice("Homepage cannot be opened due to plugin unavailablity.");
			return;
		}
		else if (this.data.kind == Kind.Workspace) {
			await this.launchWorkspace();
		}
		else {
			let mode = this.plugin.loaded ? this.data.manualOpenMode : this.data.openMode;
			if (alternate) mode = Mode.Retain;
			
			await this.launchPage(mode as Mode);
		}
		
		if (!this.data.commands) return;
				
		for (let command of this.data.commands) {
			(this.app as any).commands.executeCommandById(command);
		}
	}
	
	async launchWorkspace() {
		let workspacePlugin = this.plugin.internalPlugins.workspaces?.instance;
		
		if(!(this.data.value in workspacePlugin.workspaces)) {
			new Notice(`Cannot find the workspace "${this.data.value}" to use as the homepage.`);
			return;
		}
		
		workspacePlugin.loadWorkspace(this.computedValue);
	}
	
	async launchPage(mode: Mode) {
		this.computedValue = this.computeValue();
		this.plugin.executing = true;
		
		if (getDailynotesAutorun(this.plugin) && !this.plugin.loaded) {
			return;
		}
		else if (!this.data.autoCreate && await this.isNonextant()) {
			new Notice(`Homepage "${this.computedValue}" does not exist.`);
			return;
		}
		
		if (mode != Mode.ReplaceAll) {
			const alreadyOpened = this.getOpened();
	
			if (alreadyOpened.length > 0) {
				this.app.workspace.setActiveLeaf(alreadyOpened[0]);
				await this.configure();
				return;
			}
		}
		else {
			LEAF_TYPES.forEach(i => this.app.workspace.detachLeavesOfType(i));
		}
		
		if (mode != Mode.Retain) {
			//hack to fix pin bug
			this.app.workspace.getActiveViewOfType(OView)?.leaf.setPinned(false);
		}
		
		do {
			await this.app.workspace.openLinkText(
				this.computedValue, "", mode == Mode.Retain, { active: true }
			);
		}
		//hack to fix bug with opening link when homepage is already extant beforehand
		while (this.app.workspace.getActiveFile() == null);
		
		if (mode == Mode.ReplaceAll) {
			this.app.workspace.detachLeavesOfType("empty");
		}
	
		await this.configure();
	}
		
	async isNonextant(): Promise<boolean> {
		let name = untrimName(this.computedValue);
		return !(await this.app.vault.adapter.exists(name));
	} 
	
	async configure(): Promise<void> {
		this.plugin.executing = false;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		
		if (!view) {
			//for canvas, kanban
			if (this.data.pin) {
				this.app.workspace.getActiveViewOfType(OView)?.leaf.setPinned(true);	
			}
			return;	
		}
		
		const state = view.getState();
		
		if (this.data.revertView && this.plugin.loaded) {
			this.lastView = new WeakRef(view);
		}
	
		if (this.data.autoScroll) {
			const count = view.editor.lineCount();
			
			if (state.mode == "preview") {
				view.previewMode.applyScroll(count - 4);
			}
			else {
				view.editor.setCursor(count);
				view.editor.focus();
			}
		}	
		
		if (this.data.pin) view.leaf.setPinned(true);	
		if (this.data.view == View.Default) return;
	
		switch(this.data.view) {
			case View.LivePreview:
			case View.Source:
				state.mode = "source";
				state.source = this.data.view != View.LivePreview;
				break;
			case View.Reading:
				state.mode = "preview";
				break;
		}
	
		await view.leaf.setViewState({type: "markdown", state: state});
		
		if (this.plugin.loaded && this.data.refreshDataview) { 
			this.plugin.communityPlugins.dataview?.index.touch();
		}
	}
	
	getOpened(): WorkspaceLeaf[] {
		let leaves = LEAF_TYPES.flatMap(i => this.app.workspace.getLeavesOfType(i));
		return leaves.filter(
			leaf => trimFile((leaf.view as any).file) == this.computedValue
		);
	}
	
	computeValue(): string {
		let val = this.data.value;
		let dailyNotes, format;
	
		switch (this.data.kind) {
			case Kind.MomentDate:
				val = moment().format(this.data.value);
				break;
			case Kind.Random:
				const file = randomFile(this.app);
				if (file) val = file;
				break;
			case Kind.DailyNote:
				dailyNotes = this.plugin.internalPlugins["daily-notes"];
				format = dailyNotes.instance.options.format;
				val = moment().format(format || "YYYY-MM-DD");
				break;
		}
	
		return val
	}
	
	async save(): Promise<void> {
		this.plugin.settings.homepages[this.name] = this.data; 
		await this.plugin.saveSettings();
	}
	
	revertView = async (): Promise<void> => {
		if (!this.plugin.loaded || this.lastView == undefined) return;
		
		const view = this.lastView.deref();
		if (!view || trimFile(view.file) == this.computedValue) return;
	
		const state = view.getState();
		const config = (this.app.vault as any).config;
		
		console.log(state.mode, state.source);
		state.mode = config.defaultViewMode;
		state.source = !config.livePreview;
		await view.leaf.setViewState({type: "markdown", state: state});
		this.lastView = undefined;
	}	
}