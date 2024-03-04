import { TAbstractFile } from "obsidian";
import { Kind, Mode } from "src/homepage";
import { sleep } from "src/utils";
import HomepageTestPlugin from "./harness";

export default class OpeningTests {
	async replaceAll(this: HomepageTestPlugin) {
		await this.app.workspace.openLinkText("Note A", "", false);
		await this.app.workspace.openLinkText("Note B", "", true);
		
		this.homepage.data.manualOpenMode = Mode.ReplaceAll;
		this.homepage.save();
		
		this.homepage.open();
		await sleep(200);
		
		const file = this.app.workspace.getActiveFile();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		this.assert(file?.name == "Home.md" && leaves.length == 1, file, leaves);
	}
	
	async replaceAllImage(this: HomepageTestPlugin) {
		await this.app.workspace.openLinkText("Note A", "", false);
		await this.app.workspace.openLinkText("Image.png", "", true);
		
		this.homepage.data.manualOpenMode = Mode.ReplaceAll;
		this.homepage.save();
		
		this.homepage.open();
		await sleep(200);
		
		const leaves = this.app.workspace.getLeavesOfType("image");
		this.assert(leaves.length == 0, leaves);
	}
	
	async replaceLast(this: HomepageTestPlugin) {
		await this.app.workspace.openLinkText("Note A", "", false);
		await this.app.workspace.openLinkText("Note B", "", true);
		
		this.homepage.data.manualOpenMode = Mode.ReplaceLast;
		this.homepage.save();

		this.homepage.open();
		await sleep(100);
		
		const file = this.app.workspace.getActiveFile();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		this.assert(file?.name == "Home.md" && leaves.length == 2, file, leaves);
	}
	
	async retain(this: HomepageTestPlugin) {
		await this.app.workspace.openLinkText("Note A", "", false);
		await this.app.workspace.openLinkText("Note B", "", true);
		
		this.homepage.data.manualOpenMode = Mode.Retain;
		this.homepage.save();
	
		this.homepage.open();
		await sleep(100);
		
		const file = this.app.workspace.getActiveFile();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		this.assert(file?.name == "Home.md" && leaves.length == 3, file, leaves);
	}
	
	async commands(this: HomepageTestPlugin) {
		this.addCommand({
			id: "nv-test-command",
			name: "Test",
			callback: () => this.test = true
		});
		
		this.homepage.data.commands = ["homepage:nv-test-command"];
		this.homepage.save();
	
		this.homepage.open();
		await sleep(100);
		
		this.assert(this.test, this);
	}
	
	async autoCreate(this: HomepageTestPlugin) {
		this.homepage.data.value = "temp";
		this.homepage.save();

		this.homepage.open();
		await sleep(100);
		
		let file = this.app.workspace.getActiveFile();
		this.assert(file?.name == "temp.md", file);
		
		this.app.vault.delete(file as TAbstractFile);
		
		this.homepage.data.autoCreate = false;
		this.homepage.save();
	
		this.homepage.open();
		await sleep(100);
		
		file = this.app.workspace.getActiveFile();
		this.assert(file?.name != "temp.md", file);
	}
	
	async random(this: HomepageTestPlugin) {
		this.homepage.data.kind = Kind.Random;
		this.homepage.save();
		
		//check that the files are different at least 1/10 times
		let name = null, newname;
		
		for (let i = 0; i < 10; i++) {
			this.homepage.open();
			await sleep(70);
			newname = this.app.workspace.getActiveFile()?.name;
			
			if (i > 0 && newname !== name) return;
			name = newname;
		}
		this.assert(false);
	}
	
	async openWhenEmpty(this: HomepageTestPlugin) {
		this.homepage.data.openWhenEmpty = true;
		this.homepage.save();
		
		this.app.workspace.iterateAllLeaves(l => l.detach());
		await sleep(500);
		
		const file = this.app.workspace.getActiveFile();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		this.assert(file?.name == "Home.md" && leaves.length == 1, file, leaves);
	}
	
	async openWhenEmptyReplaceAll(this: HomepageTestPlugin) {
		this.homepage.data.openWhenEmpty = true;
		this.homepage.data.manualOpenMode = Mode.ReplaceAll;
		this.homepage.save();
		
		this.app.workspace.iterateAllLeaves(l => l.detach());
		await sleep(500);
		
		const file = this.app.workspace.getActiveFile();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		this.assert(file?.name == "Home.md" && leaves.length == 1, file, leaves);
	}	
}
