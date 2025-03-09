function getDomainsList(filesPath) {
    var result = [];
    var files = glob.apply(null, [filesPath, true, ".json"]);

    for (var i = 0; i < files.length; i++) {
        var name = files[i].split("/").pop().replace(/\.json$/, "");
        result.push({ name: name, data: require(files[i]) });
    }

    return result;
}

var allDomains = getDomainsList("./domains");

var commit = [];

for (var subdomain in allDomains) {
    var subdomainName = allDomains[subdomain].name;
    var domainData = allDomains[subdomain].data;
    var proxyState = domainData.proxied ? { cloudflare_proxy: "on" } : { cloudflare_proxy: "off" };

    // Handle A records
    if (domainData.target.A) {
        for (var a in domainData.target.A.value) {
            commit.push(A(domainData.target.A.name, IP(domainData.target.A.value[a]), proxyState));
        }
    }

    // Handle AAAA records
    if (domainData.target.AAAA) {
        for (var aaaa in domainData.target.AAAA.value) {
            commit.push(AAAA(domainData.target.AAAA.name, domainData.target.AAAA.value[aaaa], proxyState));
        }
    }

    // Handle CNAME records
    if (domainData.target.CNAME) {
        if (subdomainName === "@") {
            commit.push(ALIAS(domainData.target.CNAME.name, domainData.target.CNAME.value + ".", proxyState));
        } else {
            commit.push(CNAME(domainData.target.CNAME.name, domainData.target.CNAME.value + ".", proxyState));
        }
    }

    // Handle NS records
    if (domainData.target.NS) {
        for (var ns in domainData.target.NS.value) {
            commit.push(NS(domainData.target.NS.name, domainData.target.NS.value[ns] + "."));
        }
    }

    // Handle TXT records
    if (domainData.target.TXT) {
        if (Array.isArray(domainData.target.TXT)) {
            for (var txt in domainData.target.TXT) {
                var txtRecord = domainData.target.TXT[txt];
                commit.push(TXT(txtRecord.name, txtRecord.value));
            }
        } else {
            commit.push(TXT(domainData.target.TXT.name === "@" ? subdomainName : domainData.target.TXT.name + "." + subdomainName, domainData.target.TXT.value));
        }
    }
}

// ✅ Add Zoho TXT, MX, SPF, and CNAME records
commit.push(TXT("dentisystems", "zoho-verification=zb61229538.zmverify.zoho.com"));
commit.push(MX("dentisystems", 10, "mx.zoho.com."));
commit.push(MX("dentisystems", 20, "mx2.zoho.com."));
commit.push(MX("dentisystems", 50, "mx3.zoho.com."));
commit.push(TXT("dentisystems", "v=spf1 include:zoho.com ~all"));
commit.push(CNAME("autodiscover.dentisystems", "autodiscover.zoho.com."));

// *.mx.is-a-good.dev
commit.push(IGNORE("*", "MX", "*"));

// Commit all DNS records
D("is-a-good.dev", NewRegistrar("none"), DnsProvider(NewDnsProvider("cloudflare")), commit);
