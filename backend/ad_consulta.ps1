# Lê computadores e usuários do Active Directory e devolve JSON (usado pela rota /api/computadores/ad-direto).
# Usa o leitor embutido do Windows (System.DirectoryServices), sem o módulo RSAT e sem senha:
# roda com a identidade do processo — no serviço do IT Manager (LocalSystem), a conta da máquina VM-MONIT$.
# Os campos seguem o exportar_ad.ps1 do pacote de integração, para passarem pelo lerADComputadores/lerADUsuarios.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Buscar([string]$filtro, [string[]]$props) {
    $s = New-Object DirectoryServices.DirectorySearcher
    $s.Filter = $filtro
    $s.PageSize = 1000
    foreach ($p in $props) { [void]$s.PropertiesToLoad.Add($p) }
    $s.FindAll()
}
function Valor($r, [string]$nome) { $v = $r.Properties[$nome]; if ($v -and $v.Count) { $v[0] } else { $null } }
function DataFT($ft, [string]$formato) { if ($ft -and [int64]$ft -gt 0) { [DateTime]::FromFileTime([int64]$ft).ToString($formato) } else { '' } }
function Criado($d) { if ($d) { ([DateTime]$d).ToLocalTime().ToString('yyyy-MM-dd') } else { '' } }
function OU([string]$dn) { if ($dn) { ($dn -split ',', 2)[1] } else { '' } }
function Habilitado($uac) { if ($null -ne $uac) { -not ([int]$uac -band 2) } else { $null } }

$computadores = foreach ($r in Buscar '(objectCategory=computer)' @('name', 'useraccountcontrol', 'operatingsystem', 'operatingsystemversion', 'lastlogontimestamp', 'whencreated', 'dnshostname', 'description', 'distinguishedname')) {
    $ip = ''
    $dns = Valor $r 'dnshostname'
    if ($dns) { try { $ip = ([Net.Dns]::GetHostAddresses($dns) | Where-Object AddressFamily -eq 'InterNetwork' | Select-Object -First 1).IPAddressToString } catch { } }
    [ordered]@{
        Name                   = Valor $r 'name'
        Enabled                = Habilitado (Valor $r 'useraccountcontrol')
        OperatingSystem        = Valor $r 'operatingsystem'
        OperatingSystemVersion = Valor $r 'operatingsystemversion'
        UltimoLogon            = DataFT (Valor $r 'lastlogontimestamp') 'yyyy-MM-dd HH:mm'
        CriadoEm               = Criado (Valor $r 'whencreated')
        IPv4Address            = $ip
        Description            = Valor $r 'description'
        OU                     = OU (Valor $r 'distinguishedname')
    }
}

$usuarios = foreach ($r in Buscar '(&(objectCategory=person)(objectClass=user))' @('samaccountname', 'name', 'useraccountcontrol', 'department', 'title', 'description', 'lastlogontimestamp', 'pwdlastset', 'whencreated', 'distinguishedname')) {
    $uac = Valor $r 'useraccountcontrol'
    [ordered]@{
        SamAccountName       = Valor $r 'samaccountname'
        Name                 = Valor $r 'name'
        Enabled              = Habilitado $uac
        Department           = Valor $r 'department'
        Title                = Valor $r 'title'
        Description          = Valor $r 'description'
        UltimoLogon          = DataFT (Valor $r 'lastlogontimestamp') 'yyyy-MM-dd HH:mm'
        SenhaAlteradaEm      = DataFT (Valor $r 'pwdlastset') 'yyyy-MM-dd'
        PasswordNeverExpires = if ($null -ne $uac) { [bool]([int]$uac -band 0x10000) } else { $null }
        CriadoEm             = Criado (Valor $r 'whencreated')
        OU                   = OU (Valor $r 'distinguishedname')
    }
}

ConvertTo-Json -InputObject ([ordered]@{ identidade = [Security.Principal.WindowsIdentity]::GetCurrent().Name; computadores = @($computadores); usuarios = @($usuarios) }) -Depth 4 -Compress
