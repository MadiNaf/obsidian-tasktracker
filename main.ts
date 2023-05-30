import {
	Editor,
	FileSystemAdapter,
	MarkdownPostProcessorContext,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
	ViewState,
	normalizePath,
	parseYaml
} from 'obsidian';

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

interface ProgressBarElements {
	progressionBar: HTMLElement;
	progressionText: HTMLElement;
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
  SMALL: '250px',
  MEDIUM: '350px',
  LARGE: '400px'
}

const DEFAULT_SETTINGS: TaskTrackerSetting = {
	colors: [RED, ORANGE, YELLOW, GREEN],
	size: SIZES.SMALL
}

const CONTAINER_BASE_ID = 'task-tracker-container';
const PROGRESSION_BAR_BASE_ID = 'task-tracker-progression-bar';
const PROGRESSION_TEXT_BASE_ID = 'task-tracker-progression-text';

const TASK_TODO = '- [ ]';
const TASK_DONE_LOW = '- [x]';
const TASK_TODO_UPP = '- [X]';

/** ---------------------------------------------- \
 *              		TaskTracker plugin                  
\ ----------------------------------------------- */
export default class TaskTracker extends Plugin {
	
	readonly ERROR_MESSAGES: {[key: string] : string} = {
		invalidPath: 'Invalid path',
		fileNameNotProvided: 'File name is not provided',
		fileNotFound: 'File note found!' 
	}

	currentFilePath: string;
	fileSystemAdapter: FileSystemAdapter = new FileSystemAdapter();
	
	async onload() {
		this.registerMarkdownCodeBlockProcessor('tasktracker', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext ) => {
			const config = parseYaml(source) as TaskTrackerConfig;

			if (!config?.path) {
				this.throwError(el, this.ERROR_MESSAGES.invalidPath);
				return;
			}

			if (!config?.fileName) {
				this.throwError(el, this.ERROR_MESSAGES.fileNameNotProvided);
				return;
			}

			this.buildTaskTracker(el, config).then((progressBarElements: ProgressBarElements) => {
				this.registerEvent(
					this.app.vault.on( 'modify', async (file: TAbstractFile) => {
					const msgStatus = await this.updateTaskTrackerAfterFileChange(file as TFile, config, progressBarElements);
					console.log(msgStatus)
				})
				);
			}).catch((error) => {
				console.error(error)
			});

		});

	}

	/**
	 * 
	 * @param el 
	 * @param config 
	 * @returns 
	 */
	async buildTaskTracker(el: HTMLElement, config: TaskTrackerConfig): Promise<string | ProgressBarElements> {
		return new Promise(async (resolve, reject) => {
			const {path, fileName} = config;
			try {
				const folder = this.app.vault.getAbstractFileByPath(normalizePath(path));

				if (folder && folder instanceof TFolder) {
					const file: TFile = this.getFileByName(folder, fileName) as TFile;

					if (!file) reject('TDOD :: error message')

					const fileContent = await this.app.vault.read(file);
					const tasks = this.getFileTasks(fileContent);
					const progressBarElements = this.crateProgressBar(el, config, tasks, fileName);
					resolve(progressBarElements);
				}
	
			} catch (error) {
				reject(`BUILD_ERROR :: ${error}`);
			}
		});
	}

	async updateTaskTrackerAfterFileChange(file: TFile, config: TaskTrackerConfig, progressBarElements: ProgressBarElements): Promise<string> {
		return new Promise(async (resolve, reject) => {
			try {
				const fileContent = await this.app.vault.read(file);
				const tasks = this.getFileTasks(fileContent);
				const taskProgression: number = this.getTaskProgression(tasks);
				const { colors } = this.getUserSettings(config);
				const color: string = this.getProgressionColor(taskProgression, colors);
		
				const progressionBarId = this.generateElementId(PROGRESSION_BAR_BASE_ID, file.basename);
				const progressionTextId = this.generateElementId(PROGRESSION_TEXT_BASE_ID, file.basename);
				
				const progressionBar = document.getElementById(progressionBarId) as HTMLElement;
				const progressionText = document.getElementById(progressionTextId) as HTMLElement;
								
				if (progressionBar) {
					progressionBar.style.width = `${taskProgression}%`;
					progressionBar.style.backgroundColor = color;
				}
				
				if (progressionText) progressionText.setText(`${taskProgression}%`);

				// -----------> POC using workspace leaf
				const leaf = this.app.workspace.getLeaf();
				let currentViewState = leaf.getViewState();
				// const currentView = leaf.view;
				let currentState = currentViewState?.state;
				currentState = { ...currentState, mode: 'preview', source: true };
				currentViewState = {...currentViewState, state: currentState };


				leaf.setViewState(currentViewState);
				this.app.workspace.setActiveLeaf(leaf);
				console.log('CURRNET_VIEW_STATE :: ', currentViewState);
				console.log('CURRENT_LEAF :: ', leaf);
				// <----------- 
				resolve('OK');
			} catch (error) {
				reject(`UPDATE_ERROR :: ${error}`);
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
			const isTaskToDo: boolean = line.includes(TASK_TODO);
			const isCompletedTask: boolean = line.includes(TASK_DONE_LOW) || line.includes(TASK_TODO_UPP);

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

	getTaskProgression(tasks: Taske): number {
		const { completedTasks, incompleteTask } = tasks;
		const total: number = completedTasks + incompleteTask;
		return Math.floor((completedTasks / total) * 100);
	}

	getUserSettings(config: TaskTrackerConfig): TaskTrackerSetting {
		const { settings } = config;
		const size = !!settings?.size ? settings.size : DEFAULT_SETTINGS.size;
		const colors = !!settings?.colors ? settings.colors : DEFAULT_SETTINGS.colors;
		return { size, colors };
	}

	generateElementId(baseId: string, fileName: string): string {
		const concatName = fileName.split(' ').join('');
		return `${baseId}-${concatName}`;
	}

	/**
	 * 
	 * @param el 
	 * @param config 
	 * @param tasks 
	 */
	crateProgressBar(el: HTMLElement, config: TaskTrackerConfig, tasks: Taske, fileName: string): ProgressBarElements {
		// Progression
		const taskProgression: number = this.getTaskProgression(tasks);

		// Get user settings or use default
		const { size, colors } = this.getUserSettings(config);
		const color: string = this.getProgressionColor(taskProgression, colors);

		// Progress bar container HTML element
		const progressbarContainer: HTMLElement = el.createDiv() // document.createElement('div');
		progressbarContainer['id'] = this.generateElementId(CONTAINER_BASE_ID, fileName);
		progressbarContainer.classList.add('task-tracker-container');
		progressbarContainer.style.width = SIZES?.[size];

		// Progress bar HTML element
		const progressBarElement: HTMLElement = progressbarContainer.createDiv(); // document.createElement('div');
		const progressionElement: HTMLElement = progressBarElement.createDiv(); // document.createElement('div');

		progressBarElement.classList.add('task-tracker-progress-bar');
		progressionElement['id'] = this.generateElementId(PROGRESSION_BAR_BASE_ID, fileName);
		progressionElement.style.height = '100%';
		progressionElement.style.width = `${taskProgression}%`;
		progressionElement.style.backgroundColor = color;

		// Progression text
		const progressionText: HTMLElement = document.createElement('p');
		const textNode: Text = document.createTextNode(`${taskProgression}%`);
		progressionText.style.color = color;
		progressionText['id'] = this.generateElementId(PROGRESSION_TEXT_BASE_ID, fileName);
		progressionText.classList.add('task-progression-text');
		progressionText.appendChild(textNode);

		// Build HTML structure
		// progressBarElement.appendChild(progressionElement);
		// progressbarContainer.appendChild(progressBarElement);
		progressbarContainer.appendChild(progressionText);
		// el.appendChild(progressbarContainer);

		

		return { progressionBar: progressionElement, progressionText};
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