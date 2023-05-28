import {FileSystemAdapter, MarkdownPostProcessorContext, Plugin, TFile, TFolder, normalizePath, parseYaml } from 'obsidian';

/** ---------------------------------------------- \
 *              		MODELS                  
\ ----------------------------------------------- */
interface TaskTrackerSetting {
	size: string;
	colors: Array<string>;
}

interface TaskTrackerConfig {
	path: string;
	fileName: string;
	label?: string;
	settings?: TaskTrackerSetting
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

/** ---------------------------------------------- \
 *              		Constents                 
\ ----------------------------------------------- */
const RED = '#BF616A';
const ORANGE = '#D08770';
const YELLOW = '#EBCB8B';
const GREEN = '#A3BE8C';

const SIZES: {[key: string]: string} = {
  sbar: '220px',
  mbar: '245px',
  lbar: '270px',
  xlbar: '295px'
}

const DEFAULT_SETTINGS: TaskTrackerSetting = {
	colors: [RED, ORANGE, YELLOW, GREEN],
	size: SIZES.sbar
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

		// this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf) => {});
	}

	/**
	 * 
	 * @param el 
	 * @param config 
	 * @returns 
	 */
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
					this.crateProgressBar(el, config, tasks);
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

	/**
	 * 
	 * @param fileContent 
	 * @returns 
	 */
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
    return tasks;
	}

	/**
	 * 
	 * @param el 
	 * @param config 
	 * @param tasks 
	 */
	crateProgressBar(el: HTMLElement, config: TaskTrackerConfig, tasks: Taske): void {
		// Progression 
		const { completedTasks, incompleteTask } = tasks;
		const total: number = completedTasks + incompleteTask;
		const taskProgression: number = Math.floor((completedTasks / total) * 100);

		// Get user settings or use default
		const { settings } = config;
		const size = settings?.size ? settings.size : DEFAULT_SETTINGS.size;
		const colors = settings?.colors ? settings.colors : DEFAULT_SETTINGS.colors;
		const color: string = this.getProgressionColor(taskProgression, colors);

		// Progress bar container HTML element
		const progressbarContainer: HTMLElement = document.createElement('div');
		progressbarContainer.classList.add('task-tracker-container');
		progressbarContainer.style.width = SIZES?.[size];

		// Progress bar HTML element
		const progressBarElement: HTMLElement = document.createElement('div');
		const progressionElement: HTMLElement = document.createElement('div');

		progressBarElement.classList.add('task-tracker-progress-bar');
		progressionElement.style.height = '100%';
		progressionElement.style.width = `${taskProgression}%`;
		progressionElement.style.backgroundColor = color;

		// Progression text
		const progressionText: HTMLElement = document.createElement('p');
		const textNode: Text = document.createTextNode(`${taskProgression}%`);
		progressionText.style.color = color;
		progressionText.classList.add('task-progression-text');
		progressionText.appendChild(textNode);

		// Build HTML structure
		progressBarElement.appendChild(progressionElement)
		progressbarContainer.appendChild(progressBarElement)
		progressbarContainer.appendChild(progressionText)
		el.appendChild(progressbarContainer)
	}

	/**
	 * 
	 * @param progress 
	 * @param colors 
	 * @returns 
	 */
	getProgressionColor(progress: number, colors: string[]): string {
		const from0To25: string = colors?.length ? colors [0] : GREEN;
		const from26To50: string = colors?.length >= 2 ? colors[1] : from0To25;
		const from51To99: string = colors?.length >= 3 ? colors[2] : from26To50;
		const hundredPercent: string = colors?.length >= 4 ? colors[3] : from51To99;

		if (progress <= 25) return from0To25;
		else if (progress <= 50) return from26To50;
		else if (progress <= 99) return from51To99;
		else return hundredPercent;
	}

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