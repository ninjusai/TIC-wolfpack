<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';

	let { children } = $props();
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
	<div class="container-fluid">
		<a class="navbar-brand fw-bold" href="/">BCE</a>
		<button
			class="navbar-toggler"
			type="button"
			data-bs-toggle="collapse"
			data-bs-target="#navbarNav"
			aria-controls="navbarNav"
			aria-expanded="false"
			aria-label="Toggle navigation"
		>
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="navbarNav">
			<ul class="navbar-nav">
				<li class="nav-item">
					<a class="nav-link" href="/">Dashboard</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" href="/preview">Preview</a>
				</li>
			</ul>
			<ul class="navbar-nav ms-auto">
				<li class="nav-item">
					<span class="nav-link text-light opacity-50 small">Export: open a blueprint, then "View Export"</span>
				</li>
			</ul>
		</div>
	</div>
</nav>

<div class="container-fluid">
	{@render children()}
</div>
