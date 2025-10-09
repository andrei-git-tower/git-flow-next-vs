// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitFlowConfig {
    main: string;
    develop: string;
    feature: string;
    release: string;
    hotfix: string;
    support: string;
    bugfix: string;
}

interface BranchInfo {
    type: 'feature' | 'release' | 'hotfix' | 'support' | 'bugfix' | 'main' | 'develop' | 'unknown';
    name: string;
    fullName: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Git Flow Next extension is now active!');
    console.log('Extension context:', context.extension.id);
    vscode.window.showInformationMessage('Git Flow Next Extension Activated!');

    // Context variables for conditional command visibility
    const contextKeys = {
        isOnTopicBranch: 'gitFlowNext.isOnTopicBranch',
        isOnFeatureBranch: 'gitFlowNext.isOnFeatureBranch',
        isOnReleaseBranch: 'gitFlowNext.isOnReleaseBranch',
        isOnHotfixBranch: 'gitFlowNext.isOnHotfixBranch',
        isOnSupportBranch: 'gitFlowNext.isOnSupportBranch',
        isOnBugfixBranch: 'gitFlowNext.isOnBugfixBranch',
        featuresExist: 'gitFlowNext.featuresExist',
        releasesExist: 'gitFlowNext.releasesExist',
        hotfixesExist: 'gitFlowNext.hotfixesExist',
        supportsExist: 'gitFlowNext.supportsExist',
        bugfixesExist: 'gitFlowNext.bugfixesExist'
    };

    // Helper function to update context variables
    async function updateContextVariables() {
        try {
            const branchInfo = await getCurrentBranch();
            
            // Set branch type contexts
            await vscode.commands.executeCommand('setContext', contextKeys.isOnTopicBranch, 
                branchInfo.type !== 'main' && branchInfo.type !== 'develop' && branchInfo.type !== 'unknown');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnFeatureBranch, branchInfo.type === 'feature');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnReleaseBranch, branchInfo.type === 'release');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnHotfixBranch, branchInfo.type === 'hotfix');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnSupportBranch, branchInfo.type === 'support');
            await vscode.commands.executeCommand('setContext', contextKeys.isOnBugfixBranch, branchInfo.type === 'bugfix');

            // Check if branches exist for each type
            const [features, releases, hotfixes, supports, bugfixes] = await Promise.all([
                getBranchList('feature'),
                getBranchList('release'),
                getBranchList('hotfix'),
                getBranchList('support'),
                getBranchList('bugfix')
            ]);

            await vscode.commands.executeCommand('setContext', contextKeys.featuresExist, features.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.releasesExist, releases.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.hotfixesExist, hotfixes.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.supportsExist, supports.length > 0);
            await vscode.commands.executeCommand('setContext', contextKeys.bugfixesExist, bugfixes.length > 0);

        } catch (error) {
            // Reset all contexts if not in a git repository
            for (const key of Object.values(contextKeys)) {
                await vscode.commands.executeCommand('setContext', key, false);
            }
        }
    }

    // Helper function to get list of branches of a specific type
    async function getBranchList(type: string): Promise<string[]> {
        try {
            const output = await executeGitFlowCommand(`${type} list`, [], { showOutput: false, showError: false });
            return output.split('\n').filter(line => line.trim()).map(line => line.trim());
        } catch (error) {
            return [];
        }
    }

    // Update context when workspace changes
    updateContextVariables();
    const workspaceDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        updateContextVariables();
    });
    context.subscriptions.push(workspaceDisposable);

    // Update context when git state changes (branch switches, etc.)
    const gitDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
        // Check if this might be a git operation by looking for .git directory changes
        if (document.fileName.includes('.git/') || document.fileName.endsWith('.gitignore')) {
            // Debounce context updates
            setTimeout(() => updateContextVariables(), 1000);
        }
    });
    context.subscriptions.push(gitDisposable);

    // Helper function to execute git flow commands
    async function executeGitFlowCommand(command: string, args: string[] = [], options: { showOutput?: boolean; showError?: boolean } = {}): Promise<string> {
        const { showOutput = true, showError = true } = options;
        
        // Check if we have a workspace
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder open. Please open a git repository folder.');
        }
        
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const fullCommand = `git flow ${command} ${args.join(' ')}`;
        
        try {
            const { stdout, stderr } = await execAsync(fullCommand, {
                cwd: workspacePath
            });
            
            if (stderr && showError) {
                console.error(`Git Flow Error: ${stderr}`);
            }
            
            if (showOutput && stdout.trim()) {
                vscode.window.showInformationMessage(`Git Flow: ${stdout.trim()}`);
            }
            
            return stdout;
        } catch (error: any) {
            const errorMessage = error.message || error.toString();
            if (showError) {
                vscode.window.showErrorMessage(`Git Flow Error: ${errorMessage}`);
            }
            throw error;
        }
    }

    // Helper function to get current branch info
    async function getCurrentBranch(): Promise<BranchInfo> {
        // Check if we have a workspace
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder open. Please open a git repository folder.');
        }
        
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        try {
            const { stdout } = await execAsync('git branch --show-current', {
                cwd: workspacePath
            });
            
            const branchName = stdout.trim();
            
            // Determine branch type based on naming conventions
            if (branchName.startsWith('feature/')) {
                return {
                    type: 'feature',
                    name: branchName.replace('feature/', ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith('release/')) {
                return {
                    type: 'release',
                    name: branchName.replace('release/', ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith('hotfix/')) {
                return {
                    type: 'hotfix',
                    name: branchName.replace('hotfix/', ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith('support/')) {
                return {
                    type: 'support',
                    name: branchName.replace('support/', ''),
                    fullName: branchName
                };
            } else if (branchName.startsWith('bugfix/')) {
                return {
                    type: 'bugfix',
                    name: branchName.replace('bugfix/', ''),
                    fullName: branchName
                };
            } else if (branchName === 'main' || branchName === 'master') {
                return {
                    type: 'main',
                    name: branchName,
                    fullName: branchName
                };
            } else if (branchName === 'develop') {
                return {
                    type: 'develop',
                    name: branchName,
                    fullName: branchName
                };
            } else {
                return {
                    type: 'unknown',
                    name: branchName,
                    fullName: branchName
                };
            }
        } catch (error) {
            throw new Error('Not in a git repository');
        }
    }

    // Helper function to prompt for input
    async function promptForInput(prompt: string, placeholder?: string): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a valid value';
                }
                return null;
            }
        });
    }

    // Helper function to show branch selection
    async function showBranchSelection(branches: string[], prompt: string): Promise<string | undefined> {
        if (branches.length === 0) {
            vscode.window.showInformationMessage('No branches found');
            return undefined;
        }
        
        return await vscode.window.showQuickPick(branches, {
            placeHolder: prompt
        });
    }

    // Initialize Git Flow
    const initCommand = vscode.commands.registerCommand('git-flow-next.init', async () => {
        try {
            const preset = await vscode.window.showQuickPick([
                { label: 'Classic', description: 'Traditional GitFlow with main, develop, feature, release, hotfix' },
                { label: 'GitHub', description: 'GitHub Flow with main and feature branches' },
                { label: 'GitLab', description: 'GitLab Flow with production, staging, main, feature, and hotfix' },
                { label: 'Custom', description: 'Custom configuration with interactive setup' }
            ], {
                placeHolder: 'Select a Git Flow preset'
            });

            if (!preset) return;

            const presetMap: { [key: string]: string } = {
                'Classic': 'classic',
                'GitHub': 'github',
                'GitLab': 'gitlab',
                'Custom': 'custom'
            };

            const args = preset.label === 'Custom' ? ['--custom'] : [`--preset=${presetMap[preset.label]}`];
            await executeGitFlowCommand('init', args);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize Git Flow: ${error}`);
        }
    });

    // Feature commands
    const featureStartCommand = vscode.commands.registerCommand('git-flow-next.feature.start', async () => {
        const featureName = await promptForInput('Enter feature name', 'my-feature');
        if (featureName) {
            await executeGitFlowCommand('feature start', [featureName]);
            await updateContextVariables();
        }
    });

    const featureFinishCommand = vscode.commands.registerCommand('git-flow-next.feature.finish', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'feature') {
                await executeGitFlowCommand('feature finish', [branchInfo.name]);
            } else {
                // Show list of features to finish
                const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
                const features = output.split('\n').filter(line => line.trim()).map(line => line.trim());
                const selectedFeature = await showBranchSelection(features, 'Select feature to finish');
                if (selectedFeature) {
                    await executeGitFlowCommand('feature finish', [selectedFeature]);
                }
            }
            await updateContextVariables();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish feature: ${error}`);
        }
    });

    const featureListCommand = vscode.commands.registerCommand('git-flow-next.feature.list', async () => {
        await executeGitFlowCommand('feature list');
    });

    const featureCheckoutCommand = vscode.commands.registerCommand('git-flow-next.feature.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
            const features = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedFeature = await showBranchSelection(features, 'Select feature to checkout');
            if (selectedFeature) {
                await executeGitFlowCommand('feature checkout', [selectedFeature]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout feature: ${error}`);
        }
    });

    const featureDeleteCommand = vscode.commands.registerCommand('git-flow-next.feature.delete', async () => {
        try {
            const output = await executeGitFlowCommand('feature list', [], { showOutput: false });
            const features = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedFeature = await showBranchSelection(features, 'Select feature to delete');
            if (selectedFeature) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete feature "${selectedFeature}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('feature delete', [selectedFeature]);
                    await updateContextVariables();
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete feature: ${error}`);
        }
    });

    const featureRenameCommand = vscode.commands.registerCommand('git-flow-next.feature.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'feature') {
                const newName = await promptForInput('Enter new feature name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('feature rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a feature branch to rename it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename feature: ${error}`);
        }
    });

    const featureUpdateCommand = vscode.commands.registerCommand('git-flow-next.feature.update', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'feature') {
                await executeGitFlowCommand('feature update', [branchInfo.name]);
            } else {
                vscode.window.showWarningMessage('You must be on a feature branch to update it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update feature: ${error}`);
        }
    });

    // Release commands
    const releaseStartCommand = vscode.commands.registerCommand('git-flow-next.release.start', async () => {
        const version = await promptForInput('Enter release version', '1.0.0');
        if (version) {
            await executeGitFlowCommand('release start', [version]);
        }
    });

    const releaseFinishCommand = vscode.commands.registerCommand('git-flow-next.release.finish', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'release') {
                await executeGitFlowCommand('release finish', [branchInfo.name]);
            } else {
                const output = await executeGitFlowCommand('release list', [], { showOutput: false });
                const releases = output.split('\n').filter(line => line.trim()).map(line => line.trim());
                const selectedRelease = await showBranchSelection(releases, 'Select release to finish');
                if (selectedRelease) {
                    await executeGitFlowCommand('release finish', [selectedRelease]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish release: ${error}`);
        }
    });

    const releaseListCommand = vscode.commands.registerCommand('git-flow-next.release.list', async () => {
        await executeGitFlowCommand('release list');
    });

    const releaseCheckoutCommand = vscode.commands.registerCommand('git-flow-next.release.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('release list', [], { showOutput: false });
            const releases = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedRelease = await showBranchSelection(releases, 'Select release to checkout');
            if (selectedRelease) {
                await executeGitFlowCommand('release checkout', [selectedRelease]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout release: ${error}`);
        }
    });

    const releaseDeleteCommand = vscode.commands.registerCommand('git-flow-next.release.delete', async () => {
        try {
            const output = await executeGitFlowCommand('release list', [], { showOutput: false });
            const releases = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedRelease = await showBranchSelection(releases, 'Select release to delete');
            if (selectedRelease) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete release "${selectedRelease}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('release delete', [selectedRelease]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete release: ${error}`);
        }
    });

    const releaseRenameCommand = vscode.commands.registerCommand('git-flow-next.release.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'release') {
                const newName = await promptForInput('Enter new release version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('release rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a release branch to rename it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename release: ${error}`);
        }
    });

    const releaseUpdateCommand = vscode.commands.registerCommand('git-flow-next.release.update', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'release') {
                await executeGitFlowCommand('release update', [branchInfo.name]);
            } else {
                vscode.window.showWarningMessage('You must be on a release branch to update it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update release: ${error}`);
        }
    });

    // Hotfix commands
    const hotfixStartCommand = vscode.commands.registerCommand('git-flow-next.hotfix.start', async () => {
        const version = await promptForInput('Enter hotfix version', '1.0.1');
        if (version) {
            await executeGitFlowCommand('hotfix start', [version]);
        }
    });

    const hotfixFinishCommand = vscode.commands.registerCommand('git-flow-next.hotfix.finish', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'hotfix') {
                await executeGitFlowCommand('hotfix finish', [branchInfo.name]);
            } else {
                const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
                const hotfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
                const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to finish');
                if (selectedHotfix) {
                    await executeGitFlowCommand('hotfix finish', [selectedHotfix]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish hotfix: ${error}`);
        }
    });

    const hotfixListCommand = vscode.commands.registerCommand('git-flow-next.hotfix.list', async () => {
        await executeGitFlowCommand('hotfix list');
    });

    const hotfixCheckoutCommand = vscode.commands.registerCommand('git-flow-next.hotfix.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
            const hotfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to checkout');
            if (selectedHotfix) {
                await executeGitFlowCommand('hotfix checkout', [selectedHotfix]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout hotfix: ${error}`);
        }
    });

    const hotfixDeleteCommand = vscode.commands.registerCommand('git-flow-next.hotfix.delete', async () => {
        try {
            const output = await executeGitFlowCommand('hotfix list', [], { showOutput: false });
            const hotfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedHotfix = await showBranchSelection(hotfixes, 'Select hotfix to delete');
            if (selectedHotfix) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete hotfix "${selectedHotfix}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('hotfix delete', [selectedHotfix]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete hotfix: ${error}`);
        }
    });

    const hotfixRenameCommand = vscode.commands.registerCommand('git-flow-next.hotfix.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'hotfix') {
                const newName = await promptForInput('Enter new hotfix version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('hotfix rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a hotfix branch to rename it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename hotfix: ${error}`);
        }
    });

    const hotfixUpdateCommand = vscode.commands.registerCommand('git-flow-next.hotfix.update', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'hotfix') {
                await executeGitFlowCommand('hotfix update', [branchInfo.name]);
            } else {
                vscode.window.showWarningMessage('You must be on a hotfix branch to update it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update hotfix: ${error}`);
        }
    });

    // Support commands
    const supportStartCommand = vscode.commands.registerCommand('git-flow-next.support.start', async () => {
        const version = await promptForInput('Enter support version', '1.0');
        if (version) {
            await executeGitFlowCommand('support start', [version]);
        }
    });

    const supportFinishCommand = vscode.commands.registerCommand('git-flow-next.support.finish', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'support') {
                await executeGitFlowCommand('support finish', [branchInfo.name]);
            } else {
                const output = await executeGitFlowCommand('support list', [], { showOutput: false });
                const supports = output.split('\n').filter(line => line.trim()).map(line => line.trim());
                const selectedSupport = await showBranchSelection(supports, 'Select support to finish');
                if (selectedSupport) {
                    await executeGitFlowCommand('support finish', [selectedSupport]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish support: ${error}`);
        }
    });

    const supportListCommand = vscode.commands.registerCommand('git-flow-next.support.list', async () => {
        await executeGitFlowCommand('support list');
    });

    const supportCheckoutCommand = vscode.commands.registerCommand('git-flow-next.support.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('support list', [], { showOutput: false });
            const supports = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedSupport = await showBranchSelection(supports, 'Select support to checkout');
            if (selectedSupport) {
                await executeGitFlowCommand('support checkout', [selectedSupport]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout support: ${error}`);
        }
    });

    const supportDeleteCommand = vscode.commands.registerCommand('git-flow-next.support.delete', async () => {
        try {
            const output = await executeGitFlowCommand('support list', [], { showOutput: false });
            const supports = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedSupport = await showBranchSelection(supports, 'Select support to delete');
            if (selectedSupport) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete support "${selectedSupport}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('support delete', [selectedSupport]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete support: ${error}`);
        }
    });

    const supportRenameCommand = vscode.commands.registerCommand('git-flow-next.support.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'support') {
                const newName = await promptForInput('Enter new support version', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('support rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a support branch to rename it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename support: ${error}`);
        }
    });

    const supportUpdateCommand = vscode.commands.registerCommand('git-flow-next.support.update', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'support') {
                await executeGitFlowCommand('support update', [branchInfo.name]);
            } else {
                vscode.window.showWarningMessage('You must be on a support branch to update it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update support: ${error}`);
        }
    });

    // Bugfix commands
    const bugfixStartCommand = vscode.commands.registerCommand('git-flow-next.bugfix.start', async () => {
        const bugfixName = await promptForInput('Enter bugfix name', 'my-bugfix');
        if (bugfixName) {
            await executeGitFlowCommand('bugfix start', [bugfixName]);
        }
    });

    const bugfixFinishCommand = vscode.commands.registerCommand('git-flow-next.bugfix.finish', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'bugfix') {
                await executeGitFlowCommand('bugfix finish', [branchInfo.name]);
            } else {
                const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
                const bugfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
                const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to finish');
                if (selectedBugfix) {
                    await executeGitFlowCommand('bugfix finish', [selectedBugfix]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish bugfix: ${error}`);
        }
    });

    const bugfixListCommand = vscode.commands.registerCommand('git-flow-next.bugfix.list', async () => {
        await executeGitFlowCommand('bugfix list');
    });

    const bugfixCheckoutCommand = vscode.commands.registerCommand('git-flow-next.bugfix.checkout', async () => {
        try {
            const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
            const bugfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to checkout');
            if (selectedBugfix) {
                await executeGitFlowCommand('bugfix checkout', [selectedBugfix]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to checkout bugfix: ${error}`);
        }
    });

    const bugfixDeleteCommand = vscode.commands.registerCommand('git-flow-next.bugfix.delete', async () => {
        try {
            const output = await executeGitFlowCommand('bugfix list', [], { showOutput: false });
            const bugfixes = output.split('\n').filter(line => line.trim()).map(line => line.trim());
            const selectedBugfix = await showBranchSelection(bugfixes, 'Select bugfix to delete');
            if (selectedBugfix) {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete bugfix "${selectedBugfix}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('bugfix delete', [selectedBugfix]);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete bugfix: ${error}`);
        }
    });

    const bugfixRenameCommand = vscode.commands.registerCommand('git-flow-next.bugfix.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'bugfix') {
                const newName = await promptForInput('Enter new bugfix name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('bugfix rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('You must be on a bugfix branch to rename it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename bugfix: ${error}`);
        }
    });

    const bugfixUpdateCommand = vscode.commands.registerCommand('git-flow-next.bugfix.update', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type === 'bugfix') {
                await executeGitFlowCommand('bugfix update', [branchInfo.name]);
            } else {
                vscode.window.showWarningMessage('You must be on a bugfix branch to update it');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update bugfix: ${error}`);
        }
    });

    // Shorthand commands
    const shorthandFinishCommand = vscode.commands.registerCommand('git-flow-next.shorthand.finish', async () => {
        try {
            await executeGitFlowCommand('finish');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to finish current branch: ${error}`);
        }
    });

    const shorthandDeleteCommand = vscode.commands.registerCommand('git-flow-next.shorthand.delete', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete "${branchInfo.fullName}"?`,
                    'Yes', 'No'
                );
                if (confirmed === 'Yes') {
                    await executeGitFlowCommand('delete');
                }
            } else {
                vscode.window.showWarningMessage('Cannot delete main/develop or unknown branch');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete current branch: ${error}`);
        }
    });

    const shorthandRebaseCommand = vscode.commands.registerCommand('git-flow-next.shorthand.rebase', async () => {
        try {
            await executeGitFlowCommand('rebase');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rebase current branch: ${error}`);
        }
    });

    const shorthandUpdateCommand = vscode.commands.registerCommand('git-flow-next.shorthand.update', async () => {
        try {
            await executeGitFlowCommand('update');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update current branch: ${error}`);
        }
    });

    const shorthandRenameCommand = vscode.commands.registerCommand('git-flow-next.shorthand.rename', async () => {
        try {
            const branchInfo = await getCurrentBranch();
            if (branchInfo.type !== 'unknown' && branchInfo.type !== 'main' && branchInfo.type !== 'develop') {
                const newName = await promptForInput('Enter new branch name', branchInfo.name);
                if (newName) {
                    await executeGitFlowCommand('rename', [newName]);
                }
            } else {
                vscode.window.showWarningMessage('Cannot rename main/develop or unknown branch');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename current branch: ${error}`);
        }
    });

    const shorthandPublishCommand = vscode.commands.registerCommand('git-flow-next.shorthand.publish', async () => {
        try {
            await executeGitFlowCommand('publish');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to publish current branch: ${error}`);
        }
    });

    // Overview command
    const overviewCommand = vscode.commands.registerCommand('git-flow-next.overview', async () => {
        try {
            await executeGitFlowCommand('overview');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show overview: ${error}`);
        }
    });

    // Config command
    const configCommand = vscode.commands.registerCommand('git-flow-next.config', async () => {
        try {
            await executeGitFlowCommand('config');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show config: ${error}`);
        }
    });

    // Register all commands
    context.subscriptions.push(
        initCommand,
        featureStartCommand, featureFinishCommand, featureListCommand, featureCheckoutCommand,
        featureDeleteCommand, featureRenameCommand, featureUpdateCommand,
        releaseStartCommand, releaseFinishCommand, releaseListCommand, releaseCheckoutCommand,
        releaseDeleteCommand, releaseRenameCommand, releaseUpdateCommand,
        hotfixStartCommand, hotfixFinishCommand, hotfixListCommand, hotfixCheckoutCommand,
        hotfixDeleteCommand, hotfixRenameCommand, hotfixUpdateCommand,
        supportStartCommand, supportFinishCommand, supportListCommand, supportCheckoutCommand,
        supportDeleteCommand, supportRenameCommand, supportUpdateCommand,
        bugfixStartCommand, bugfixFinishCommand, bugfixListCommand, bugfixCheckoutCommand,
        bugfixDeleteCommand, bugfixRenameCommand, bugfixUpdateCommand,
        shorthandFinishCommand, shorthandDeleteCommand, shorthandRebaseCommand,
        shorthandUpdateCommand, shorthandRenameCommand, shorthandPublishCommand,
        overviewCommand, configCommand
    );
}

export function deactivate() {}