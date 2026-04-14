# Setup Windows Scheduled Task for Daily Memory Check
# Run this script as Administrator to create the scheduled task

param(
    [string]$PythonPath = "python",
    [string]$Time = "09:00",
    [switch]$Remove
)

$TaskName = "WolfPackMemoryCheck"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$ScriptPath = Join-Path $ProjectRoot "squad\memory\scripts\daily_memory_check.py"

if ($Remove) {
    Write-Host "Removing scheduled task: $TaskName"
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Task removed."
    exit 0
}

# Create the action
$Action = New-ScheduledTaskAction -Execute $PythonPath -Argument "`"$ScriptPath`" --log-to-db --notify" -WorkingDirectory $ProjectRoot

# Create the trigger (daily at specified time)
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time

# Create settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the task
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Daily Wolf Pack memory system health check" -Force
    Write-Host "Scheduled task '$TaskName' created successfully."
    Write-Host "  Runs daily at: $Time"
    Write-Host "  Script: $ScriptPath"
    Write-Host ""
    Write-Host "To remove: .\setup_scheduled_task.ps1 -Remove"
    Write-Host "To test now: schtasks /run /tn $TaskName"
} catch {
    Write-Error "Failed to create scheduled task: $_"
    Write-Host "Try running this script as Administrator."
    exit 1
}
