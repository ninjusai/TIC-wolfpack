<svelte:head>
	<title>Dashboard - Bookingtimes Emulator</title>
	<meta name="description" content="Bookingtimes.com Content Creation Emulator" />
</svelte:head>

<div class="mb-4">
	<h1 class="fw-bold mb-1">Dashboard</h1>
	<p class="text-muted">Bookingtimes.com Content Creation Emulator</p>
</div>

<div class="row g-4">
	<div class="col-md-6 col-lg-4">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<div class="rounded-circle bg-primary bg-opacity-10 p-3 me-3">
						<i class="fa-solid fa-globe text-primary"></i>
					</div>
					<div>
						<h6 class="card-title mb-0">Sites</h6>
						<small class="text-muted">Manage site configurations</small>
					</div>
				</div>
				<a href="/sites" class="btn btn-outline-primary btn-sm">View Sites</a>
			</div>
		</div>
	</div>

	<div class="col-md-6 col-lg-4">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<div class="rounded-circle bg-success bg-opacity-10 p-3 me-3">
						<i class="fa-solid fa-layer-group text-success"></i>
					</div>
					<div>
						<h6 class="card-title mb-0">Templates</h6>
						<small class="text-muted">Page templates library</small>
					</div>
				</div>
				<a href="/templates" class="btn btn-outline-success btn-sm">View Templates</a>
			</div>
		</div>
	</div>

	<div class="col-md-6 col-lg-4">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<div class="rounded-circle bg-info bg-opacity-10 p-3 me-3">
						<i class="fa-solid fa-file-lines text-info"></i>
					</div>
					<div>
						<h6 class="card-title mb-0">Pages</h6>
						<small class="text-muted">Content pages editor</small>
					</div>
				</div>
				<a href="/pages" class="btn btn-outline-info btn-sm">View Pages</a>
			</div>
		</div>
	</div>

	<div class="col-md-6 col-lg-4">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<div class="rounded-circle bg-warning bg-opacity-10 p-3 me-3">
						<i class="fa-solid fa-bars-staggered text-warning"></i>
					</div>
					<div>
						<h6 class="card-title mb-0">Batch</h6>
						<small class="text-muted">Batch operations</small>
					</div>
				</div>
				<a href="/batch" class="btn btn-outline-warning btn-sm">View Batch</a>
			</div>
		</div>
	</div>

	<div class="col-md-6 col-lg-4">
		<div class="card border-0 shadow-sm h-100">
			<div class="card-body">
				<div class="d-flex align-items-center mb-3">
					<div class="rounded-circle bg-secondary bg-opacity-10 p-3 me-3">
						<i class="fa-solid fa-gear text-secondary"></i>
					</div>
					<div>
						<h6 class="card-title mb-0">Settings</h6>
						<small class="text-muted">Application settings</small>
					</div>
				</div>
				<a href="/settings" class="btn btn-outline-secondary btn-sm">View Settings</a>
			</div>
		</div>
	</div>
</div>
