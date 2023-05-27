import {FileSystemAdapter, MarkdownPostProcessorContext, Plugin, TFile, TFolder, normalizePath, parseYaml } from 'obsidian';

/** ---------------------------------------------- \
 *              		MODELS                  
\ ----------------------------------------------- */

type TSize = 'Small' | 'Medium' | 'Large'
interface TaskTrackerSetting {
	size: TSize;
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

class Taske {
	incompleteTask: number;
	completedTasks: number;
	list: Array<TaskeLine>

	constructor(incompleteTask: number, completedTasks: number, list: Array<TaskeLine>) {
		this.incompleteTask = incompleteTask;
		this.completedTasks = completedTasks;
		this.list = list;
	}
}

const DEFAULT_SETTINGS: TaskTrackerSetting = {
	colors: ['default'],
	size: 'Small'
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
			// 	const lineNumber: number = index + 1;
			// 	const content: string = line.replace('- [ ]', '').replace('- [x]', '').trim();
			// 	const completed: boolean = isCompletedTask;
      //   taskList.push({ line: lineNumber, content, completed });
      // }
		});

		tasks = new Taske(todo, done, taskList);
    console.log('Tasks:', tasks);
    return tasks;
	}

	crateProgressBar(): void {}

	/**
	 * 
	 * @param el 
	 * @param errorMessage 
	 */
	throwError(el: HTMLElement, errorMessage: string) {
		el.createEl('div', { text:  `TaskTrackerError: ${errorMessage}` });
	}

	onunload() {

	}

}