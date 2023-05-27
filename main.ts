import {FileSystemAdapter, MarkdownPostProcessorContext, Plugin, TFile, TFolder, normalizePath, parseYaml } from 'obsidian';

/** ---------------------------------------------- \
 *              		MODELS                  
\ ----------------------------------------------- */

interface TaskTrackerSetting {
	colors: Array<string>;
}

interface TaskTrackerConfig {
	path: string;
	fileName: string;
	label?: string;
	config?: TaskTrackerSetting
}

interface TaskeLine {
	line: number;
	content: string;
	completed: boolean;
}

interface Taske {
	incompleteTask: number;
	completedTasks: number;
	list: Array<TaskeLine>
}

const DEFAULT_SETTINGS: TaskTrackerSetting = {
	colors: ['default']
}

/** ---------------------------------------------- \
 *              		TaskTracker plugin                  
\ ----------------------------------------------- */
export default class TaskTracker extends Plugin {
	
	readonly ERROR_MESSAGES: {[key: string] : string} = {
		invalidPath: 'Invalid path',
		fileNameNotProvided: 'File name is not provided',
		fileNotFound: 'File note found!' 
	}

	fileSystemAdapter: FileSystemAdapter = new FileSystemAdapter();
	
	async onload() {
		this.registerMarkdownCodeBlockProcessor('tasktracker', (source: string, el: HTMLElement, ctx:MarkdownPostProcessorContext ) => {
			const config = parseYaml(source) as TaskTrackerConfig;

			if (!config?.path) {
				this.throwError(el, this.ERROR_MESSAGES.invalidPath);
				return;
			}

			if (!config?.fileName) {
				this.throwError(el, this.ERROR_MESSAGES.fileNameNotProvided);
				return;
			}

			this.buildTaskTracker(el, config).then(() => {});
		});
	}

	async buildTaskTracker(el: HTMLElement, config: TaskTrackerConfig): Promise<string> {
		return new Promise(async (resolve, reject) => {
			console.log('CONFIG ::: ', config);
			const {path, fileName} = config;

			try {
				const folder = this.app.vault.getAbstractFileByPath(normalizePath(path));

				if (folder && folder instanceof TFolder) {
					const file: TFile = this.getFileByName(folder, fileName) as TFile;

					if (!file) reject('TDOD :: error message')

					const fileContent = await this.app.vault.read(file);
					const tasks = this.getFileTasks(fileContent);
					console.log('TASKS ::: ', tasks);
				}
	
			} catch (error) {
				console.log('ERROR :::: ', error);
			}
		});
	}

	/**
	 * 
	 * @param sourceFolder 
	 * @param fileName 
	 * @returns 
	 */
	getFileByName(sourceFolder: TFolder, fileName: String): TFile | null {
		const folderChildren = sourceFolder?.children;

		if (!folderChildren?.length) return null;

		const targetFile = folderChildren.find(child => {
			return (child instanceof TFile && child.extension === 'md') && child.name === `${fileName}.md`;
		});

		return targetFile as TFile;
	}

	getFileTasks(fileContent: string): Taske {
		const lines: string[] = fileContent.split('\n');
		const taskList: TaskeLine[] = [];
		let tasks: Taske;
		let todo: number = 0;
		let done: number = 0;

		lines.forEach((line: string, index: number) => {
			const isTaskToDo: boolean = line.includes('- [ ]');
			const isCompletedTask: boolean = line.includes('- [x]');

			if (isTaskToDo) todo = todo + 1 ;
			if (isCompletedTask) done = done + 1;

			// if (isTaskToDo || isCompletedTask) {
      //   taskList.push({
      //     line: index + 1,
      //     content: line.replace('- [ ]', '').replace('- [x]', '').trim(),
      //     completed: line.includes('- [x]')
      //   });
      // }
		});

		tasks = {
			incompleteTask: todo,
			completedTasks: done,
			list: taskList,
		}
    
    console.log('Tasks:', tasks);
    return tasks;
	}

	/**
	 * 
	 * @param el 
	 * @param errorMessage 
	 */
	throwError(el: HTMLElement, errorMessage: string) {
		el.createEl('div', { text:  `TaskTrackerError: ${errorMessage}` });
	}

		// onunload() {

	// }

	// async loadSettings() {
	// 	this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	// }

	// async saveSettings() {
	// 	await this.saveData(this.settings);
	// }
}


// class SampleSettingTab extends PluginSettingTab {
// 	plugin: MyPlugin;

// 	constructor(app: App, plugin: TaskTracker) {
// 		super(app, plugin);
// 		this.plugin = plugin;
// 	}

// 	display(): void {
// 		const {containerEl} = this;

// 		containerEl.empty();

// 		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

// 		new Setting(containerEl)
// 			.setName('Setting #1')
// 			.setDesc('It\'s a secret')
// 			.addText(text => text
// 				.setPlaceholder('Enter your secret')
// 				.setValue(this.plugin.settings.mySetting)
// 				.onChange(async (value) => {
// 					console.log('Secret: ' + value);
// 					this.plugin.settings.mySetting = value;
// 					await this.plugin.saveSettings();
// 				}));
// 	}
// }
